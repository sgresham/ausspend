import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  FAIRFIELD_GPFS_DELIVERY_ENTITY,
  FAIRFIELD_GPFS_FISCAL_YEAR,
  FAIRFIELD_GPFS_ID,
  FAIRFIELD_GPFS_LICENSE,
  FAIRFIELD_GPFS_NAME,
  FAIRFIELD_GPFS_PUBLISHER,
  FAIRFIELD_GPFS_REPORTING_URL,
  detectFairfieldGpfsUnit,
  discoverFairfieldGpfsDocument,
  fairfieldGpfsNaturalKey,
  fiscalYearFromFairfieldGpfsLink,
  parseFairfieldGpfsExtraction,
  parseFairfieldGpfsReportPage,
  type FairfieldGpfsParseContext,
} from '../src/connectors/fairfield-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  FAIRFIELD_PDF_SHA256,
  FAIRFIELD_PDF_URL,
  fairfieldComprehensivePage,
  fairfieldConductReportPage,
  fairfieldDepreciationPage,
  fairfieldExtraction,
  fairfieldFunctionsPage,
  fairfieldIncomePage,
} from './fairfield-gpfs.fixture.js';

// Fairfield publishes a standalone audited financial statements PDF on its
// official Corporate Reports page. Its Income Statement prints the Original
// unaudited budget column first, the FY2024-25 Actual column second and the
// restated FY2023-24 column third. The text stream groups labels before
// amounts, so the adapter reconstructs printed rows from text-item coordinates
// and reads the middle (Actual 2025) column. The printed borrowing-costs line
// and net gain on disposal are both non-nil and emitted.

const CONTEXT: FairfieldGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Fairfield City Council Audited Financial Statements 2024-25',
    url: FAIRFIELD_PDF_URL,
    fiscal_year: FAIRFIELD_GPFS_FISCAL_YEAR,
    listing_url: FAIRFIELD_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/fairfield-gpfs/fairfield-city-council-audited-financial-statements-2024-25.pdf',
    sha256: FAIRFIELD_PDF_SHA256,
    bytes: 17_656_220,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: FAIRFIELD_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseFairfieldGpfsExtraction(fairfieldExtraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Fairfield City Council GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official Corporate Reports page, not a hard-coded PDF URL', () => {
    const pageHtml = `
      <p><a href="/files/assets/public/v/1/documents/your-council/ipr/annual-report/2023-2024-annual-report-audited-financial-statements.pdf" title="2023-2024-Annual-Report-Audited-Financial-Statements.pdf">2023-2024 Financial Statements</a></p>
      <p><a href="/files/assets/public/v/1/documents/your-council/ipr/annual-report/2024-2025-annual-report-combined.pdf" title="2024-2025-Annual-Report-Combined.pdf">2024-2025 Annual Report</a></p>
      <p><a href="/files/assets/public/v/1/documents/your-council/ipr/annual-report/2024-2025-annual-report-audited-financial-statements.pdf" title="2024-2025-Annual-Report-Audited-Financial-Statements.pdf">2024-2025 Financial Statements</a></p>
    `;
    expect(parseFairfieldGpfsReportPage(pageHtml, FAIRFIELD_GPFS_REPORTING_URL, '2024-25')).toEqual(
      {
        pdfUrl: FAIRFIELD_PDF_URL,
        title: 'Fairfield City Council Audited Financial Statements 2024-25',
      },
    );
    expect(fiscalYearFromFairfieldGpfsLink('2024-2025 Financial Statements')).toBe('2024-25');
    expect(
      fiscalYearFromFairfieldGpfsLink('2024-2025-Annual-Report-Audited-Financial-Statements.pdf'),
    ).toBe('2024-25');
    expect(fiscalYearFromFairfieldGpfsLink('Financial statements 2025/26')).toBe('2025-26');
    expect(fiscalYearFromFairfieldGpfsLink('Financial statements year ended 30 June 2025')).toBe(
      '2024-25',
    );
  });

  it('resolves the PDF through the official listing', async () => {
    const discovered = await discoverFairfieldGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: `<a href="${FAIRFIELD_PDF_URL}">2024-2025 Financial Statements</a>`,
    });
    expect(discovered.title).toBe('Fairfield City Council Audited Financial Statements 2024-25');
    expect(discovered.url).toBe(FAIRFIELD_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(FAIRFIELD_GPFS_REPORTING_URL);
  });

  it('refuses to guess when only the combined annual report or a prior year is present', () => {
    expect(
      parseFairfieldGpfsReportPage(
        '<a href="/files/assets/public/v/1/documents/your-council/ipr/annual-report/2024-2025-annual-report-combined.pdf">2024-2025 Annual Report</a>',
        FAIRFIELD_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
    expect(
      parseFairfieldGpfsReportPage(
        '<a href="/files/assets/public/v/1/documents/your-council/ipr/annual-report/2023-2024-annual-report-audited-financial-statements.pdf">2023-2024 Financial Statements</a>',
        FAIRFIELD_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parseFairfieldGpfsReportPage(
        '<a href="https://example.com/2024-2025-annual-report-audited-financial-statements.pdf">2024-2025 Financial Statements</a>',
        FAIRFIELD_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Fairfield City Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectFairfieldGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectFairfieldGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const income = fairfieldIncomePage();
    const withoutUnit = {
      ...income,
      text: income.text.replace('$', '').replace("'000", ''),
      items: income.items.filter((entry) => entry.str !== '$' && entry.str !== "'000"),
    };
    const parsed = parseFairfieldGpfsExtraction(
      fairfieldExtraction({ income: withoutUnit }),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Fairfield City Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1, comprehensive income and note B3-3 exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(269_959);
    expect(reconciliation.total_expenses).toBe(207_778);
    expect(reconciliation.employee_expenses).toBe(93_091);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(38_287);
    expect(reconciliation.government_grants_operating).toBe(24_944);
    expect(reconciliation.government_grants_capital).toBe(58_649);
    expect(reconciliation.borrowing_costs).toBe(166);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(609);
    expect(reconciliation.net_result).toBe(62_181);
    expect(reconciliation.operating_result).toBe(62_181);
    expect(reconciliation.operating_result_excluding_depreciation).toBe(100_468);
    expect(reconciliation.net_result_before_capital_grants).toBe(3_532);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(169_491);
    expect(reconciliation.revenue_components_sum).toBe(269_959);
    expect(reconciliation.expense_components_sum).toBe(169_491);
    expect(reconciliation.face_expense_bridge).toBe(207_778);
    expect(reconciliation.functions_total_income).toBe(269_959);
    expect(reconciliation.functions_total_expenses).toBe(207_778);
    expect(reconciliation.functions_operating_result).toBe(62_181);
    expect(reconciliation.functions_grants_and_contributions).toBe(83_593);
    expect(reconciliation.comprehensive_income_net_result).toBe(62_181);
    expect(reconciliation.comprehensive_income_other).toBe(-81_048);
    expect(reconciliation.comprehensive_income_total).toBe(-18_867);
    expect(reconciliation.depreciation_impairment_note_total).toBe(38_287);
    expect(reconciliation.income_statement_page).toBe(6);
    expect(reconciliation.functions_page).toBe(19);
    expect(reconciliation.comprehensive_income_page).toBe(7);
    expect(reconciliation.depreciation_note_page).toBe(32);
    expect(reconciliation.conduct_report).toEqual({
      page_number: 77,
      operating_result_millions: 62.2,
      grants_and_contributions_millions: 83.6,
      revenue_excluding_grants_millions: 186.4,
      depreciation_millions: 38.3,
      total_expenses_millions: null,
    });
    expect(reconciliation.conduct_report_narrative_discrepancies).toEqual([]);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(26_995_900_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(20_777_800_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(9_309_100_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      3_828_700_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_494_400_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(5_864_900_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(16_600_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(60_900_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(6_218_100_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      16_949_100_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(13_357_800_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
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
        'net_gain_from_disposal_of_assets',
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
        source_id: FAIRFIELD_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: FAIRFIELD_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Fairfield City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Fairfield City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^fairfield-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'borrowing_costs').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'depreciation_amortisation_impairment').gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(recordByLine(records, 'total_expenses').notes).not.toContain('human_spot_check');
    expect(recordByLine(records, 'net_result').notes).not.toContain('human_spot_check');
    expect(recordByLine(records, 'total_expenses').notes).toContain('no human spot check');
    expect(recordByLine(records, 'employee_expenses').notes).not.toContain('human_spot_check');
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('flags a human spot check when the auditor narrative prints a different total expenses, without rejecting the exact face/B1-1 reconciliation', () => {
    const parsed = parseFairfieldGpfsExtraction(
      fairfieldExtraction({
        conductReport: fairfieldConductReportPage({ totalExpenses: '210.0' }),
      }),
      CONTEXT,
    );
    expect(parsed.records).toHaveLength(17);
    expect(parsed.reconciliation!.conduct_report_total_expenses_discrepancy_thousands).toBe(2_222);
    expect(parsed.reconciliation!.conduct_report_narrative_discrepancies.length).toBe(1);
    expect(recordByLine(parsed.records, 'total_expenses').notes).toContain(
      'human_spot_check: required',
    );
    expect(recordByLine(parsed.records, 'net_result').notes).toContain(
      'human_spot_check: required',
    );
    expect(recordByLine(parsed.records, 'employee_expenses').notes).not.toContain(
      'human_spot_check',
    );
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const parsed = parseFairfieldGpfsExtraction(
      fairfieldExtraction({ functions: fairfieldFunctionsPage({ expenses: '207,878' }) }),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const parsed = parseFairfieldGpfsExtraction(
      fairfieldExtraction({
        income: fairfieldIncomePage({ actual: { 'Rates and annual charges': '133,678' } }),
      }),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = fairfieldComprehensivePage({
      actual: { 'Net operating result for the year': '62,100' },
    });
    const parsed = parseFairfieldGpfsExtraction(
      fairfieldExtraction({ comprehensive: broken }),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-3 depreciation no longer bridges', () => {
    const parsed = parseFairfieldGpfsExtraction(
      fairfieldExtraction({ depreciation: fairfieldDepreciationPage({ total: '38,187' }) }),
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
    const revenue = fairfieldGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = fairfieldGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^fairfield-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(fairfieldGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(fairfieldGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_fairfieldgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: FAIRFIELD_GPFS_ID,
    name: FAIRFIELD_GPFS_NAME,
    publisher: FAIRFIELD_GPFS_PUBLISHER,
    source_url: FAIRFIELD_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: FAIRFIELD_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'fairfield-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Fairfield City Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: FAIRFIELD_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-fairfield-city-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Fairfield City Council',
        delivery_entity: 'Fairfield City Council',
      },
      {
        amount_cents: 51_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example2',
        verified: false,
        natural_key: 'grantconnect-fairfield-city-council-existing-2',
        project_name:
          'Second existing GrantConnect grant under the exact string Fairfield City Council',
        delivery_entity: 'Fairfield City Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-FAIRFIELD-CITY-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase FAIRFIELD CITY COUNCIL',
        delivery_entity: 'FAIRFIELD CITY COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-fairfield-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Fairfield Food Services Incorporated',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'georges-river-gpfs',
        source_url: 'https://www.georgesriver.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-georges-river-gpfs-1',
        project_name: 'Existing Georges River Council GPFS row',
        delivery_entity: 'Georges River Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-fairfield-project',
        project_name: 'Existing NSW Budget project whose name mentions Fairfield',
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
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(2);
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'georges-river-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: FAIRFIELD_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(23);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: FAIRFIELD_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(23);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Fairfield City Council',
      }),
    ).toBe(2);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'FAIRFIELD CITY COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Fairfield City Council' })).toBe(
      19,
    );
    expect(
      await MeasureModel.countDocuments({ delivery_entity: /^fairfield city council$/i }),
    ).toBe(20);

    expect(
      await MeasureModel.countDocuments({
        source_id: FAIRFIELD_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: FAIRFIELD_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: FAIRFIELD_GPFS_ID,
        delivery_entity: { $ne: 'Fairfield City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: FAIRFIELD_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
