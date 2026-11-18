import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  PORT_MACQUARIE_HASTINGS_GPFS_DELIVERY_ENTITY,
  PORT_MACQUARIE_HASTINGS_GPFS_FISCAL_YEAR,
  PORT_MACQUARIE_HASTINGS_GPFS_ID,
  PORT_MACQUARIE_HASTINGS_GPFS_LICENSE,
  PORT_MACQUARIE_HASTINGS_GPFS_NAME,
  PORT_MACQUARIE_HASTINGS_GPFS_PUBLISHER,
  PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL,
  detectPortMacquarieHastingsGpfsUnit,
  fiscalYearFromPortMacquarieHastingsGpfsLink,
  parsePortMacquarieHastingsGpfsExtraction,
  parsePortMacquarieHastingsGpfsReportLinks,
  portMacquarieHastingsGpfsNaturalKey,
  selectPortMacquarieHastingsGpfsDocument,
  type PortMacquarieHastingsGpfsParseContext,
} from '../src/connectors/port-macquarie-hastings-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// Exact text extracted from the archived FY2024-25 General Purpose Financial
// Statements (Income Statement PDF page 7, printed page 4). The Original
// unaudited budget column precedes each line label, so each value read is the
// first amount after the label (the FY2024-25 actual). The Income Statement does
// not print a combined total-expenses line; total expenses is the printed B1-1
// "Total functions and activities" total, which equals the printed
// expenses-excluding-depreciation line plus the printed depreciation/impairment
// line.
const INCOME_TEXT = `Port Macquarie-Hastings Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 121,907 Rates and annual charges B2-1 122,578 118,803 48,186 User charges and fees B2-2 47,803 47,259 7,038 Other revenues B2-3 8,149 8,680 18,205 Grants and contributions provided for operating purposes B2-4 15,089 17,183 66,961 Grants and contributions provided for capital purposes B2-4 92,780 132,080 11,114 Interest and investment income B2-5 15,263 14,041 – Other income B2-6 5,567 2,343 273,411 Total income from continuing operations 307,229 340,389 Expenses from continuing operations 71,850 Employee benefits and on-costs B3-1 74,948 64,601 71,179 Materials and services B3-2 76,589 63,274 3,029 Borrowing costs B3-3 614 236 9,149 Other expenses B3-5 8,733 10,377 3,050 Net loss from the disposal of assets B4-1 6,787 11,436 158,257 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 167,671 149,924 115,154 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 139,558 190,465 59,851 Depreciation and impairment of non-financial assets B3-4 62,164 61,302 55,303 Operating result from continuing operations 77,394 129,163 55,303 Net operating result for the year attributable to Council 77,394 129,163 (11,658) Net operating result for the year before grants and contributions provided for capital purposes (15,386) (2,917) The above Income Statement should be read in conjunction with the accompanying notes. Port Macquarie-Hastings Council Income Statement for the year ended 30 June 2025 Page 4 of 73`;

const COMPREHENSIVE_TEXT = `Port Macquarie-Hastings Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 77,394 129,163 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 150,157 123,663 Impairment reversal relating to IPPE due to natural disaster C1-6 34,371 19,911 Impairment of Infrastructure Plant & Equipment (2,497) – Total other comprehensive income for the year 182,031 143,574 Total comprehensive income for the year attributable to Council 259,425 272,737 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Port Macquarie-Hastings Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 73`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Leadership & Governance 70,610 74,484 30,177 27,663 40,433 46,821 5,311 – 55,270 88,985 Your Community Life 15,491 8,154 26,144 30,957 (10,653) (22,803) 9 12,573 383,967 366,423 Your Business and Industry 8,056 7,730 9,937 9,841 (1,881) (2,111) 12,273 244 53,447 55,070 Your Natural and Built Environment 213,072 250,021 163,577 142,765 49,495 107,256 90,276 136,446 3,273,969 2,956,372 Total functions and activities 307,229 340,389 229,835 211,226 77,394 129,163 107,869 149,263 3,766,653 3,466,850 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 73 Port Macquarie-Hastings Council | Notes to the Financial Statements 30 June 2025`;

const DEPRECIATION_TEXT = `§Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 (i) Interest bearing liability costs Interest on loans 529 990 Total interest bearing liability costs 529 990 Total interest bearing liability costs expensed 529 990 (ii) Other borrowing costs Remediation (tip) liabilities C3-5 85 (754) Total other borrowing costs 85 (754) Total borrowing costs expensed 614 236 B3-4 Depreciation, amortisation and impairment of non-financial assets §Subnote§ Depreciation and amortisation Plant and equipment, furniture and fittings 3,527 3,647 Land improvements (depreciable) 271 268 Infrastructure: C1-6 – Buildings and other structures 6,248 7,742 – Other structures 289 – – Roads, bridges and footpaths 17,031 16,436 – Other road assets 2,369 2,553 – Stormwater drainage 3,806 3,732 – Water supply network 12,447 11,798 – Sewerage network 10,589 9,936 – Other open space/recreational assets 5,201 4,805 Other assets 329 305 Reinstatement, rehabilitation and restoration assets: – Cairncross tip remediation asset C1-6 57 80 Total depreciation and amortisation costs 62,164 61,302 Total depreciation and impairment for non-financial assets 62,164 61,302 Material accounting policy information Depreciation and amortisation Depreciation and amortisation are calculated using the straight line method to allocate their cost, net of their residual values, over their estimated useful lives. Page 23 of 73`;

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'e73a1cd805f9431001da032e88c2408fb8ad19eed083d2adc46e7850cb16618c',
      bytes: 8_407_089,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 7),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 8),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 16),
      textPage(DEPRECIATION_TEXT, 26),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.pmhc.nsw.gov.au/files/assets/public/v/1/document-files/your-council/election/annualreports/2024-2025/part-2-financial-statements.pdf';

const CONTEXT: PortMacquarieHastingsGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Part 2 Financial Statements',
    url: PDF_URL,
    fiscal_year: PORT_MACQUARIE_HASTINGS_GPFS_FISCAL_YEAR,
    listing_url: PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/port-macquarie-hastings-gpfs/part-2-financial-statements.pdf',
    sha256: 'e73a1cd805f9431001da032e88c2408fb8ad19eed083d2adc46e7850cb16618c',
    bytes: 8_407_089,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parsePortMacquarieHastingsGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Port Macquarie-Hastings GPFS source discovery', () => {
  it('discovers the FY2024-25 audited financial statements from the official page, not a hard-coded URL', () => {
    const indexHtml = `
      <a href="/Your-Council/Council-reports/Annual-reports-and-statements">Annual reports and statements</a>
      <a href="/files/assets/public/v/1/document-files/your-council/election/annualreports/2024-2025/part-2-financial-statements.pdf" title="Part 2 Financial Statements">Part 2 | Financial Statements(PDF,&nbsp;8MB)</a>
      <a href="/files/assets/public/v/1/document-files/your-council/updated-2023-2024-financial-statements.pdf" title="Updated 2023-2024 Financial Statements.pdf">Part 2 | Financial Statements(PDF,&nbsp;38MB)</a>
      <a href="/files/assets/public/v/1/document-files/your-council/election/annualreports/2022-2023/report-pmhc-annual-financial-statements-2022-2023.pdf" title="Report - PMHC Annual Financial Statements - 2022 - 2023.PDF">Part 2 | Financial Statements(PDF,&nbsp;1MB)</a>
      <a href="/files/assets/public/v/1/document-files/your-council/election/annualreports/2024-2025/part-1-community-report-card.pdf" title="Part 1 Community Report Card">Part 1 | Community Report Card(PDF,&nbsp;6MB)</a>
    `;
    const links = parsePortMacquarieHastingsGpfsReportLinks(
      indexHtml,
      PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL,
    );
    const fy2425 = links.filter((link) => link.fiscal_year === '2024-25');
    expect(fy2425).toHaveLength(1);
    expect(fy2425[0]!.url).toBe(PDF_URL);
    expect(fy2425[0]!.listing_url).toBe(PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL);
    expect(selectPortMacquarieHastingsGpfsDocument(links, '2024-25').url).toBe(PDF_URL);
    expect(fiscalYearFromPortMacquarieHastingsGpfsLink('Financial Statements 2024-2025')).toBe(
      '2024-25',
    );
    expect(
      fiscalYearFromPortMacquarieHastingsGpfsLink('2024-2025/part-2-financial-statements.pdf'),
    ).toBe('2024-25');
    expect(fiscalYearFromPortMacquarieHastingsGpfsLink('2024/2025 Financial Statements')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromPortMacquarieHastingsGpfsLink('2023-2024')).toBe('2023-24');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parsePortMacquarieHastingsGpfsReportLinks(
      '<a href="/files/assets/public/v/1/document-files/your-council/election/annualreports/2022-2023/report-pmhc-annual-financial-statements-2022-2023.pdf">Part 2 | Financial Statements (PDF, 4MB)</a>',
      PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL,
    );
    expect(() => selectPortMacquarieHastingsGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Port Macquarie-Hastings GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectPortMacquarieHastingsGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectPortMacquarieHastingsGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parsePortMacquarieHastingsGpfsExtraction(
      extraction({ income: withoutUnit }),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Port Macquarie-Hastings GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles them exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(307_229);
    expect(reconciliation.total_expenses).toBe(229_835);
    expect(reconciliation.employee_expenses).toBe(74_948);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(62_164);
    expect(reconciliation.government_grants_operating).toBe(15_089);
    expect(reconciliation.government_grants_capital).toBe(92_780);
    expect(reconciliation.net_result).toBe(77_394);
    expect(reconciliation.operating_result).toBe(77_394);
    expect(reconciliation.net_result_before_capital_grants).toBe(-15_386);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(167_671);
    expect(reconciliation.revenue_components_sum).toBe(307_229);
    expect(reconciliation.expense_components_sum).toBe(167_671);
    expect(reconciliation.face_expense_bridge).toBe(229_835);
    expect(reconciliation.functions_total_income).toBe(307_229);
    expect(reconciliation.functions_total_expenses).toBe(229_835);
    expect(reconciliation.functions_operating_result).toBe(77_394);
    expect(reconciliation.functions_grants_and_contributions).toBe(107_869);
    expect(reconciliation.comprehensive_income_net_result).toBe(77_394);
    expect(reconciliation.depreciation_note_total).toBe(62_164);
    expect(reconciliation.income_statement_page).toBe(7);
    expect(reconciliation.functions_page).toBe(16);
    expect(reconciliation.comprehensive_income_page).toBe(8);
    expect(reconciliation.depreciation_note_page).toBe(26);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(30_722_900_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(22_983_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(7_494_800_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      6_216_400_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_508_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(9_278_000_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(7_739_400_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
  });

  it('emits only printed categories: components point at their printed subtotal and there is no region/LGA allocation', () => {
    const { records } = parsedFixture();
    const keys = records.map((record) => record.gpfs_line_item).sort();
    expect(keys).toEqual(
      [
        'borrowing_costs',
        'depreciation_amortisation_impairment',
        'employee_expenses',
        'government_grants_capital',
        'government_grants_operating',
        'interest_and_investment_income',
        'materials_and_services',
        'net_loss_from_disposal_of_assets',
        'net_result',
        'other_expenses',
        'other_income',
        'other_revenues',
        'rates_and_annual_charges',
        'total_expenses',
        'total_expenses_excluding_depreciation',
        'total_revenue',
        'user_charges_and_fees',
      ].sort(),
    );
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: PORT_MACQUARIE_HASTINGS_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: PORT_MACQUARIE_HASTINGS_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Port Macquarie-Hastings Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Port Macquarie-Hastings Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^port-macquarie-hastings-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    // Every row is non-additive agency detail; summing the printed rows is never the total.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace('229,835 211,226', '229,935 211,226');
    const parsed = parsePortMacquarieHastingsGpfsExtraction(
      extraction({ functions: broken }),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('122,578 118,803', '122,678 118,803');
    const parsed = parsePortMacquarieHastingsGpfsExtraction(
      extraction({ income: broken }),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 77,394',
      'from Income Statement 77,000',
    );
    const parsed = parsePortMacquarieHastingsGpfsExtraction(
      extraction({ comprehensive: broken }),
      CONTEXT,
    );
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
    const revenue = portMacquarieHastingsGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = portMacquarieHastingsGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^port-macquarie-hastings-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(portMacquarieHastingsGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(portMacquarieHastingsGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_pmhgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: PORT_MACQUARIE_HASTINGS_GPFS_ID,
    name: PORT_MACQUARIE_HASTINGS_GPFS_NAME,
    publisher: PORT_MACQUARIE_HASTINGS_GPFS_PUBLISHER,
    source_url: PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: PORT_MACQUARIE_HASTINGS_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'port-macquarie-hastings-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Port Macquarie-Hastings GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: PORT_MACQUARIE_HASTINGS_GPFS_ID })).toBe(
      0,
    );
    await MeasureModel.insertMany([
      {
        amount_cents: 96_692_800,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example1',
        verified: false,
        natural_key: 'aus-tender-Port-Macquarie-Hastings-Council-existing-1',
        project_name:
          'Existing AusTender contract under the exact string Port Macquarie-Hastings Council',
        delivery_entity: 'Port Macquarie-Hastings Council',
      },
      {
        amount_cents: 58_850,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example2',
        verified: false,
        natural_key: 'aus-tender-Port-Macquarie-Hastings-Council-existing-2',
        project_name: 'Second existing AusTender contract under Port Macquarie-Hastings Council',
        delivery_entity: 'Port Macquarie-Hastings Council',
      },
      {
        amount_cents: 215_259_600,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect-PORT-MACQUARIE-existing',
        project_name: 'Existing GrantConnect grant to a different Port Macquarie business',
        delivery_entity: 'PORT MACQUARIE MARINE SERVICES PTY LTD',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-port-macquarie-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Port Macquarie Surf Life Saving Club',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'mid-coast-gpfs',
        source_url: 'https://www.midcoast.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-mid-coast-gpfs-1',
        project_name: 'Existing MidCoast GPFS row',
        delivery_entity: 'MidCoast Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(2);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'mid-coast-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: PORT_MACQUARIE_HASTINGS_GPFS_ID })).toBe(
      17,
    );
    expect(await MeasureModel.countDocuments({})).toBe(22);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'acnc-charity'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.amount_cents)).toEqual([
      654_321, 96_692_800, 58_850, 215_259_600,
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: PORT_MACQUARIE_HASTINGS_GPFS_ID })).toBe(
      17,
    );
    expect(await MeasureModel.countDocuments({})).toBe(22);
    // The two pre-existing AusTender rows keep the exact string "Port
    // Macquarie-Hastings Council". They are preserved untouched and are never
    // summed with the 17 GPFS rows (which also carry that published entity name
    // but a different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'Port Macquarie-Hastings Council',
      }),
    ).toBe(2);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: 'Port Macquarie-Hastings Council' }),
    ).toBe(19);

    expect(
      await MeasureModel.countDocuments({
        source_id: PORT_MACQUARIE_HASTINGS_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: PORT_MACQUARIE_HASTINGS_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: PORT_MACQUARIE_HASTINGS_GPFS_ID,
        delivery_entity: { $ne: 'Port Macquarie-Hastings Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({
      source_id: PORT_MACQUARIE_HASTINGS_GPFS_ID,
    }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
