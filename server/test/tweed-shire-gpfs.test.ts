import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  TWEED_SHIRE_GPFS_DELIVERY_ENTITY,
  TWEED_SHIRE_GPFS_FISCAL_YEAR,
  TWEED_SHIRE_GPFS_ID,
  TWEED_SHIRE_GPFS_LICENSE,
  TWEED_SHIRE_GPFS_NAME,
  TWEED_SHIRE_GPFS_PUBLISHER,
  TWEED_SHIRE_GPFS_REPORTING_URL,
  detectTweedShireGpfsUnit,
  fiscalYearFromTweedShireGpfsLink,
  parseTweedShireGpfsExtraction,
  parseTweedShireGpfsReportLinks,
  selectTweedShireGpfsDocument,
  tweedShireGpfsNaturalKey,
  type TweedShireGpfsParseContext,
} from '../src/connectors/tweed-shire-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './tweed-shire-gpfs.fixture.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so each value read is the first amount after the label (the
// FY2024-25 actual). The printed expense subtotal label is physically wrapped
// around the budget amount ("... non-financial 159,480 assets 186,872"), so the
// connector reads the value after the trailing word. The Income Statement does
// not print a combined total-expenses line; total expenses is the printed B1-1
// "Total functions and activities" total, which equals the printed expenses-
// excluding-depreciation line plus the printed depreciation/impairment line.

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '8eabbdf40bf180e051598eaa90d542ca3ab8b7a27187ff0b8230b0433e7dee8f',
      bytes: 4_202_080,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 6),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 7),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 15),
      textPage(DEPRECIATION_TEXT, 25),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.tweed.nsw.gov.au/files/assets/public/v/1/documents/council/annual-and-financial-reports/tweed-shire-council-financial-statements-2024-2025.pdf';

const CONTEXT: TweedShireGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024–2025',
    url: PDF_URL,
    fiscal_year: TWEED_SHIRE_GPFS_FISCAL_YEAR,
    listing_url: TWEED_SHIRE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/tweed-shire-gpfs/tweed-shire-council-financial-statements-2024-2025.pdf',
    sha256: '8eabbdf40bf180e051598eaa90d542ca3ab8b7a27187ff0b8230b0433e7dee8f',
    bytes: 4_202_080,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: TWEED_SHIRE_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseTweedShireGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Tweed Shire GPFS source discovery', () => {
  it('discovers the FY2024-25 audited financial statements from the official page, not a hard-coded URL', () => {
    const indexHtml = `
      <a href="/council/policies-plans-reports/annual-financial-reports">Annual and financial reports</a>
      <a href="/files/assets/public/v/1/documents/council/annual-and-financial-reports/annual-financial-statements-2025–26.pdf" title="Annual financial statements 2025-26">financial statements (PDF,&nbsp;3MB)</a>
      <a href="/files/assets/public/v/1/documents/council/annual-and-financial-reports/general-purpose-financial-statements-2025–2026.pdf" title="Auditor's report 2025-26">auditor's report (PDF,&nbsp;158KB)</a>
      <a href="https://www.tweed.nsw.gov.au/files/assets/public/v/1/documents/council/annual-and-financial-reports/tweed-shire-council-financial-statements-2024-2025.pdf" title="Financial Statements 2024-2025">Financial Statements 2024–2025</a>
      <a href="/files/assets/public/v/1/documents/council/annual-and-financial-reports/tweed-shire-council-financial-statements-2023-24.pdf" title="Financial Statements 2023-2024">Financial Statements 2023–2024 (PDF,&nbsp;3MB)</a>
      <a href="/files/assets/public/v/3/documents/council/annual-and-financial-reports/ipr_annual-report-2024-2025_web.pdf" title="Annual Report 2024-2025">Annual Report 2024–2025</a>
    `;
    const links = parseTweedShireGpfsReportLinks(indexHtml, TWEED_SHIRE_GPFS_REPORTING_URL);
    const fy2425 = links.filter((link) => link.fiscal_year === '2024-25');
    expect(fy2425).toHaveLength(1);
    expect(fy2425[0]!.url).toBe(PDF_URL);
    expect(fy2425[0]!.listing_url).toBe(TWEED_SHIRE_GPFS_REPORTING_URL);
    expect(selectTweedShireGpfsDocument(links, '2024-25').url).toBe(PDF_URL);
    // The FY2025-26 files are discovered under their own year, never selected as 2024-25.
    expect(selectTweedShireGpfsDocument(links, '2025-26').url).toContain('2025');
    expect(fiscalYearFromTweedShireGpfsLink('Financial Statements 2024–2025')).toBe('2024-25');
    expect(
      fiscalYearFromTweedShireGpfsLink('tweed-shire-council-financial-statements-2024-2025.pdf'),
    ).toBe('2024-25');
    expect(fiscalYearFromTweedShireGpfsLink('2024/2025 Financial Statements')).toBe('2024-25');
    expect(fiscalYearFromTweedShireGpfsLink('2023–2024')).toBe('2023-24');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseTweedShireGpfsReportLinks(
      '<a href="/files/assets/public/v/1/documents/council/annual-and-financial-reports/tweed-shire-council-financial-statements-2023-24.pdf">Financial Statements 2023–2024 (PDF, 3MB)</a>',
      TWEED_SHIRE_GPFS_REPORTING_URL,
    );
    expect(() => selectTweedShireGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Tweed Shire GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectTweedShireGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectTweedShireGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseTweedShireGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Tweed Shire GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles them exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(342_922);
    expect(reconciliation.total_expenses).toBe(257_468);
    expect(reconciliation.employee_expenses).toBe(73_832);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(70_596);
    expect(reconciliation.government_grants_operating).toBe(17_969);
    expect(reconciliation.government_grants_capital).toBe(79_561);
    expect(reconciliation.net_result).toBe(85_454);
    expect(reconciliation.operating_result).toBe(85_454);
    expect(reconciliation.net_result_before_capital_grants).toBe(5_893);
    // The wrapped label must read the actual (186,872), never the budget (159,480).
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(186_872);
    expect(reconciliation.revenue_components_sum).toBe(342_922);
    expect(reconciliation.expense_components_sum).toBe(186_872);
    expect(reconciliation.face_expense_bridge).toBe(257_468);
    expect(reconciliation.functions_total_income).toBe(342_922);
    expect(reconciliation.functions_total_expenses).toBe(257_468);
    expect(reconciliation.functions_operating_result).toBe(85_454);
    expect(reconciliation.functions_grants_and_contributions).toBe(97_530);
    expect(reconciliation.comprehensive_income_net_result).toBe(85_454);
    expect(reconciliation.depreciation_note_total).toBe(70_596);
    expect(reconciliation.income_statement_page).toBe(6);
    expect(reconciliation.functions_page).toBe(15);
    expect(reconciliation.comprehensive_income_page).toBe(7);
    expect(reconciliation.depreciation_note_page).toBe(25);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(34_292_200_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(25_746_800_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(7_383_200_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      7_059_600_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_796_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(7_956_100_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(8_545_400_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      18_687_200_000,
    );
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
        source_id: TWEED_SHIRE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: TWEED_SHIRE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Tweed Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Tweed Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^tweed-shire-gpfs:[a-f0-9]{40}$/);
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
    const broken = FUNCTIONS_TEXT.replace('257,468 236,563', '257,568 236,563');
    const parsed = parseTweedShireGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('144,279 136,868', '144,379 136,868');
    const parsed = parseTweedShireGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 85,454',
      'from Income Statement 85,000',
    );
    const parsed = parseTweedShireGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = tweedShireGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = tweedShireGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^tweed-shire-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(tweedShireGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(tweedShireGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_tweedgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: TWEED_SHIRE_GPFS_ID,
    name: TWEED_SHIRE_GPFS_NAME,
    publisher: TWEED_SHIRE_GPFS_PUBLISHER,
    source_url: TWEED_SHIRE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: TWEED_SHIRE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'tweed-shire-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Tweed Shire GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: TWEED_SHIRE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example1',
        verified: false,
        natural_key: 'aus-tender-Tweed-Shire-Council-existing-1',
        project_name: 'Existing AusTender contract under the exact string Tweed Shire Council',
        delivery_entity: 'Tweed Shire Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect-TWEED-existing',
        project_name: 'Existing GrantConnect grant to a different Tweed organisation',
        delivery_entity: 'TWEED RIVER VALLEY ARTS COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-tweed-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Tweed Community Men’s Shed',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'port-macquarie-hastings-gpfs',
        source_url: 'https://www.pmhc.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-port-macquarie-gpfs-1',
        project_name: 'Existing Port Macquarie-Hastings GPFS row',
        delivery_entity: 'Port Macquarie-Hastings Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-tweed-project',
        project_name: 'Existing NSW Budget project whose name mentions Tweed',
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
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'port-macquarie-hastings-gpfs' })).toBe(
      1,
    );
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: TWEED_SHIRE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'acnc-charity', 'nsw-budget'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.amount_cents)).toEqual([
      654_321, 42_000_000, 999_000, 128_500,
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: TWEED_SHIRE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);
    // The pre-existing AusTender row keeps the exact string "Tweed Shire
    // Council". It is preserved untouched and never summed with the 17 GPFS rows
    // (which also carry that published entity name but a different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'Tweed Shire Council',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Tweed Shire Council' })).toBe(18);

    expect(
      await MeasureModel.countDocuments({
        source_id: TWEED_SHIRE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: TWEED_SHIRE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: TWEED_SHIRE_GPFS_ID,
        delivery_entity: { $ne: 'Tweed Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: TWEED_SHIRE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
