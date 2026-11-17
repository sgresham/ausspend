import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  MAITLAND_GPFS_DELIVERY_ENTITY,
  MAITLAND_GPFS_FISCAL_YEAR,
  MAITLAND_GPFS_ID,
  MAITLAND_GPFS_LICENSE,
  MAITLAND_GPFS_NAME,
  MAITLAND_GPFS_PUBLISHER,
  MAITLAND_GPFS_REPORTING_URL,
  detectMaitlandGpfsUnit,
  fiscalYearFromMaitlandGpfsLink,
  maitlandGpfsNaturalKey,
  parseMaitlandGpfsExtraction,
  parseMaitlandGpfsReportLinks,
  selectMaitlandGpfsDocument,
  type MaitlandGpfsParseContext,
} from '../src/connectors/maitland-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';

// Exact positioned text items from the archived FY2024-25 Income Statement
// (printed/PDF page 4, extraction page 5). The Original unaudited budget column
// precedes each label and the Actual 2025 / Actual 2024 columns follow it, so a
// parser that trusted plain-text order would read the budget. Two subtotal
// labels wrap over two visual rows and the depreciation label is emitted after
// its amounts in the plain-text stream; the connector reads positioned items.
const INCOME_TEXT = `Maitland City Council Income Statement For the year ended 30 June 2025 Original unaudited budget Actual Actual 2025 2025 2024 $'000 Notes $'000 $'000 Income from continuing operations 113,721 Rates and annual charges B2-1 114,151 107,192 10,086 User charges and fees B2-2 13,051 11,986 2,689 Other revenues 2,262 5,316 12,536 Grants and contributions provided for operating purposes B2-3 11,156 18,022 42,191 Grants and contributions provided for capital purposes B2-3 64,582 77,506 8,844 Interest and investment income 12,386 11,587 1,243 Other Income 1,429 1,301 191,310 Total income from continuing operations 219,016 232,910 Expenses from continuing operations 62,320 Employee benefits and on-costs B3-1 64,466 61,626 49,080 Materials and Services B3-2 57,227 73,035 2,527 Borrowing costs 3,710 2,521 10,045 Other expenses 11,477 10,385 - Net loss from the disposal of assets 288 786 123,972 137,168 148,353 67,338 81,849 84,557 31,952 B3-3 32,828 31,097 35,386 Operating result from continuing operations 49,021 53,461 35,386 Net operating result for the year attributable to Council 49,021 53,461 Net operating result for the year before grants and (6,805) contributions provided for capital purposes (15,562) (24,046) The above Income statement should be read in conjunction with the accompanying notes. Total expenses from continuing operations excluding depreciation and amortisation Operating result from continuing operations excluding depreciation and amortisation Depreciation, amortisation and impairment of non-financial assets Page 4`;

const FUNCTIONS_TEXT = `Maitland City Council Notes to the financial statements 30 June 2025 B. Financial Performance B1. Functions or activities B1-1 Functions or activities - income, expenses and assets Income, expenses and assets have been directly attributed to the following functions or activities. Income Expenses Operating results Grants and Contributions Carrying Amount of Assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions / Activities $'000 $'000 $'000 $'000 $'000 $'000 $'000 $'000 $'000 $'000 Liveable Maitland 57,009 65,741 72,832 64,906 (15,823) 836 62,318 77,486 452,587 407,532 Sustainable Maitland 26,512 25,150 32,839 50,306 (6,327) (25,157) 581 818 12,780 15,360 Vibrant Maitland 8,425 7,999 18,923 23,861 (10,498) (15,863) 5,629 8,276 1,516,950 1,416,057 Achieving Together 127,070 134,021 45,402 40,375 81,668 93,645 7,210 8,949 425,400 452,518 Net operating result for the year 219,016 232,910 169,995 179,449 49,021 53,461 75,739 95,528 2,407,717 2,291,467 Grants and Contributions Page 12`;

const COMPREHENSIVE_TEXT = `Maitland City Council Statement of Comprehensive Income for the year ended 30 June 2025 2025 2024 Notes $'000 $'000 Net operating result for the year - from income statement 49,021 53,461 Other comprehensive income Amounts which will not be reclassified subsequently to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 64,936 113,267 Total other comprehensive income for the year 64,936 113,267 Total comprehensive income for the year attributable to Council 113,957 166,728 Page 5`;

const DEPRECIATION_TEXT = `Maitland City Council 2025 2024 Note $'000 $'000 Intangibles - Software 62 70 Plant and equipment C1-5 2,634 2,194 Office equipment C1-5 117 125 Furniture and fittings C1-5 116 115 Infrastructure C1-5 28,038 26,812 Other assets C1-5 179 183 Tip asset C1-5 1,087 1,087 Right of use assets 595 511 Total depreciation and amortisation costs 32,828 31,097 Notes to the financial statements 30 June 2025 B3-3 Depreciation and amortisation Page 20`;

interface IncomeRow {
  y: number;
  label?: string;
  note?: string;
  budget?: number | null;
  a25?: number | null;
  a24?: number | null;
  labelOnly?: boolean;
  amountOnly?: boolean;
}

const INCOME_ROWS: IncomeRow[] = [
  {
    y: 647,
    label: 'Rates and annual charges',
    note: 'B2-1',
    budget: 113721,
    a25: 114151,
    a24: 107192,
  },
  { y: 637, label: 'User charges and fees', note: 'B2-2', budget: 10086, a25: 13051, a24: 11986 },
  { y: 626, label: 'Other revenues', budget: 2689, a25: 2262, a24: 5316 },
  {
    y: 616,
    label: 'Grants and contributions provided for operating purposes',
    note: 'B2-3',
    budget: 12536,
    a25: 11156,
    a24: 18022,
  },
  {
    y: 605,
    label: 'Grants and contributions provided for capital purposes',
    note: 'B2-3',
    budget: 42191,
    a25: 64582,
    a24: 77506,
  },
  { y: 595, label: 'Interest and investment income', budget: 8844, a25: 12386, a24: 11587 },
  { y: 584, label: 'Other Income', budget: 1243, a25: 1429, a24: 1301 },
  {
    y: 563,
    label: 'Total income from continuing operations',
    budget: 191310,
    a25: 219016,
    a24: 232910,
  },
  {
    y: 531,
    label: 'Employee benefits and on-costs',
    note: 'B3-1',
    budget: 62320,
    a25: 64466,
    a24: 61626,
  },
  { y: 521, label: 'Materials and Services', note: 'B3-2', budget: 49080, a25: 57227, a24: 73035 },
  { y: 510, label: 'Borrowing costs', budget: 2527, a25: 3710, a24: 2521 },
  { y: 500, label: 'Other expenses', budget: 10045, a25: 11477, a24: 10385 },
  { y: 489, label: 'Net loss from the disposal of assets', budget: null, a25: 288, a24: 786 },
  // Printed subtotal: label and amounts sit on separate baselines.
  {
    y: 469,
    label: 'Total expenses from continuing operations excluding depreciation',
    labelOnly: true,
  },
  { y: 467, budget: 123972, a25: 137168, a24: 148353, amountOnly: true },
  { y: 458, label: 'and amortisation', labelOnly: true },
  // Printed operating result excluding depreciation (not emitted, layout only).
  { y: 438, label: 'Operating result from continuing operations excluding', labelOnly: true },
  { y: 436, budget: 67338, a25: 81849, a24: 84557, amountOnly: true },
  { y: 427, label: 'depreciation and amortisation', labelOnly: true },
  {
    y: 395,
    label: 'Depreciation, amortisation and impairment of non-financial assets',
    note: 'B3-3',
    budget: 31952,
    a25: 32828,
    a24: 31097,
  },
  {
    y: 363,
    label: 'Operating result from continuing operations',
    budget: 35386,
    a25: 49021,
    a24: 53461,
  },
  {
    y: 342,
    label: 'Net operating result for the year attributable to Council',
    budget: 35386,
    a25: 49021,
    a24: 53461,
  },
  // Printed before-capital result: label wraps and amounts sit one row below.
  { y: 309, label: 'Net operating result for the year before grants and', labelOnly: true },
  {
    y: 299,
    label: 'contributions provided for capital purposes',
    budget: -6805,
    a25: -15562,
    a24: -24046,
  },
];

function money(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US');
  return n < 0 ? `(${abs})` : abs;
}

function item(str: string, x: number, y: number, pageNumber: number): PdfTextItem {
  return { page_number: pageNumber, str, x, y, width: 0, height: 0 };
}

function incomePage(): PdfPage {
  const items: PdfTextItem[] = [];
  for (const row of INCOME_ROWS) {
    if (!row.labelOnly) {
      if (row.budget !== undefined && row.budget !== null)
        items.push(item(money(row.budget), 104, row.y, 5));
      if (row.a25 !== undefined && row.a25 !== null)
        items.push(item(money(row.a25), 444, row.y, 5));
      if (row.a24 !== undefined && row.a24 !== null)
        items.push(item(money(row.a24), 496, row.y, 5));
    }
    if (row.label) items.push(item(row.label, 151, row.y, 5));
    if (row.note) items.push(item(row.note, 406, row.y, 5));
    if (row.amountOnly) {
      if (row.budget !== undefined && row.budget !== null)
        items.push(item(money(row.budget), 104, row.y, 5));
      if (row.a25 !== undefined && row.a25 !== null)
        items.push(item(money(row.a25), 444, row.y, 5));
      if (row.a24 !== undefined && row.a24 !== null)
        items.push(item(money(row.a24), 496, row.y, 5));
    }
  }
  items.push(item("Original unaudited budget Actual 2025 $'000 Notes $'000 $'000", 55, 721, 5));
  return { page_number: 5, text: INCOME_TEXT, items };
}

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: PdfPage; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'bc67c592a9cb0bade12b62e88457b3f67dad434442ec3bc59b15ea7c8aafbda8',
      bytes: 1_196_382,
    },
    pages: [
      overrides.income ?? incomePage(),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 13),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 6),
      textPage(DEPRECIATION_TEXT, 20),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.maitland.nsw.gov.au/sites/default/files/documents/2025-11/Financial%20Statements%202024-25%20Final.pdf';

const CONTEXT: MaitlandGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'General Purpose Financial Report 2024-25',
    url: PDF_URL,
    fiscal_year: MAITLAND_GPFS_FISCAL_YEAR,
    listing_url: MAITLAND_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/maitland-gpfs/Financial-Statements-2024-25-Final.pdf',
    sha256: 'bc67c592a9cb0bade12b62e88457b3f67dad434442ec3bc59b15ea7c8aafbda8',
    bytes: 1_196_382,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: MAITLAND_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseMaitlandGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Maitland GPFS source discovery', () => {
  it('discovers the FY2024-25 financial report from the official page, not a hard-coded URL', () => {
    const indexHtml = `
      <a href="/council/about-council/financial-reports-and-plans">Financial reports and plans</a>
      <a class="civictheme-link civictheme-link--attachment" href="https://www.maitland.nsw.gov.au/sites/default/files/documents/2025-11/Financial%20Statements%202024-25%20Final.pdf" title="Download pdf">General Purpose Financial Report 2024-25</a>
      <a href="https://www.maitland.nsw.gov.au/sites/default/files/documents/2026-09/Fees%20and%20Charges%2026-27.pdf">Fees and Charges 26-27</a>
      <a href="/sites/default/files/documents/document/mcc_asset_management_plan_-_buildings.pdf">Asset management plan - buildings</a>
      <a href="/sites/default/files/documents/2024-11/Financial%20Statements%202023-24%20Final.pdf">General Purpose Financial Report 2023-24</a>
    `;
    const links = parseMaitlandGpfsReportLinks(indexHtml, MAITLAND_GPFS_REPORTING_URL);
    const fy2425 = links.filter((link) => link.fiscal_year === '2024-25');
    expect(fy2425).toHaveLength(1);
    expect(fy2425[0]!.url).toBe(PDF_URL);
    expect(fy2425[0]!.listing_url).toBe(MAITLAND_GPFS_REPORTING_URL);
    expect(selectMaitlandGpfsDocument(links, '2024-25').url).toBe(PDF_URL);
    expect(fiscalYearFromMaitlandGpfsLink('General Purpose Financial Report 2024-25')).toBe(
      '2024-25',
    );
    expect(
      fiscalYearFromMaitlandGpfsLink(
        'annual-financial-statements-for-the-year-ended-30-june-2025.pdf',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromMaitlandGpfsLink('2024/2025 Financial Statements')).toBe('2024-25');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseMaitlandGpfsReportLinks(
      '<a href="/sites/default/files/documents/2024-11/Financial%20Statements%202023-24%20Final.pdf">General Purpose Financial Report 2023-24</a>',
      MAITLAND_GPFS_REPORTING_URL,
    );
    expect(() => selectMaitlandGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Maitland GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectMaitlandGpfsUnit(["$'000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectMaitlandGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$'000").join('');
    const page = { ...incomePage(), text: withoutUnit };
    const parsed = parseMaitlandGpfsExtraction(extraction({ income: page }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Maitland GPFS exact top-level reconciliation', () => {
  it('reads the printed top-level lines and reconciles them exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(7);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(219_016);
    expect(reconciliation.total_expenses).toBe(169_995);
    expect(reconciliation.employee_expenses).toBe(64_466);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(32_828);
    expect(reconciliation.government_grants_operating).toBe(11_156);
    expect(reconciliation.government_grants_capital).toBe(64_582);
    expect(reconciliation.net_result).toBe(49_021);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(137_168);
    expect(reconciliation.net_result_before_capital_grants).toBe(-15_562);
    expect(reconciliation.revenue_components_sum).toBe(219_017);
    expect(reconciliation.expense_components_sum).toBe(137_168);
    expect(reconciliation.grants_components_sum).toBe(75_738);
    expect(reconciliation.face_expense_bridge).toBe(169_996);
    expect(reconciliation.functions_total_income).toBe(219_016);
    expect(reconciliation.functions_total_expenses).toBe(169_995);
    expect(reconciliation.functions_operating_result).toBe(49_021);
    expect(reconciliation.functions_grants_and_contributions).toBe(75_739);
    expect(reconciliation.comprehensive_income_net_result).toBe(49_021);
    expect(reconciliation.depreciation_note_total).toBe(32_828);
    expect(reconciliation.rounding_notes).toHaveLength(4);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(21_901_600_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(16_999_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(6_446_600_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      3_282_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_115_600_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(6_458_200_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(4_902_100_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
  });

  it('emits only reconciling top-level categories: no component rows and no region/LGA allocation', () => {
    const { records } = parsedFixture();
    const keys = records.map((record) => record.gpfs_line_item).sort();
    expect(keys).toEqual(
      [
        'depreciation_amortisation_impairment',
        'employee_expenses',
        'government_grants_capital',
        'government_grants_operating',
        'net_result',
        'total_expenses',
        'total_revenue',
      ].sort(),
    );
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: MAITLAND_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: MAITLAND_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Maitland City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Maitland City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_component_of).toBeUndefined();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^maitland-gpfs:/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    // No component rows: summing every emitted row is never the reported total.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees by more than 1', () => {
    const broken = FUNCTIONS_TEXT.replace(
      '219,016 232,910 169,995 179,449',
      '219,016 232,910 169,900 179,449',
    );
    const parsed = parseMaitlandGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from income statement 49,021',
      'from income statement 49,020',
    );
    const parsed = parseMaitlandGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('is deterministic and derives stable, line-specific natural keys', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
    const url = CONTEXT.document.url;
    const revenue = maitlandGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = maitlandGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^maitland-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(maitlandGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(maitlandGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_maitlandgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: MAITLAND_GPFS_ID,
    name: MAITLAND_GPFS_NAME,
    publisher: MAITLAND_GPFS_PUBLISHER,
    source_url: MAITLAND_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: MAITLAND_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'maitland-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Maitland GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: MAITLAND_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 96_692_800,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA521629',
        project_name: 'Existing GrantConnect Maitland City Council grant',
        delivery_entity: 'MAITLAND CITY COUNCIL',
      },
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-maitland-taxi',
        project_name: 'Existing AusTender Maitland taxi contract',
        delivery_entity: 'MAITLAND TAXI SERVICE',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-maitland-school',
        project_name: 'Existing data.nsw Maitland school row (not a council row)',
        delivery_entity: 'Maitland High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-maitland-charity',
        project_name: 'Existing ACNC Maitland charity row (not the council)',
        delivery_entity: 'Maitland Family Support Incorporated',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'lake-macquarie-gpfs',
        source_url: 'https://www.lakemac.com.au/example.pdf',
        verified: false,
        natural_key: 'existing-lake-macquarie-gpfs-1',
        project_name: 'Existing Lake Macquarie GPFS row',
        delivery_entity: 'Lake Macquarie City Council',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('preserves existing rows and never double counts on re-run', async () => {
    const { records } = parsedFixture();
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'lake-macquarie-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: MAITLAND_GPFS_ID })).toBe(7);
    expect(await MeasureModel.countDocuments({})).toBe(12);

    const existing = await MeasureModel.find({
      source_id: { $in: ['grantconnect', 'aus-tender', 'data-nsw-ckan', 'acnc-charity'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.amount_cents)).toEqual([
      654_321, 123_456, 96_692_800, 12_345_000,
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: MAITLAND_GPFS_ID })).toBe(7);
    expect(await MeasureModel.countDocuments({})).toBe(12);

    expect(
      await MeasureModel.countDocuments({
        source_id: MAITLAND_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MAITLAND_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MAITLAND_GPFS_ID,
        delivery_entity: { $ne: 'Maitland City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: MAITLAND_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(7);
  });
});
