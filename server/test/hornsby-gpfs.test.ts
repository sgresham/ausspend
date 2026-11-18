import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  HORNSBY_GPFS_DELIVERY_ENTITY,
  HORNSBY_GPFS_ID,
  HORNSBY_GPFS_LICENSE,
  HORNSBY_GPFS_NAME,
  HORNSBY_GPFS_PUBLISHER,
  HORNSBY_GPFS_REPORTING_URL,
  detectHornsbyGpfsUnit,
  discoverHornsbyGpfsDocument,
  fiscalYearFromHornsbyGpfsLink,
  hornsbyGpfsNaturalKey,
  parseHornsbyGpfsExtraction,
  parseHornsbyGpfsReportPage,
  type HornsbyGpfsParseContext,
} from '../src/connectors/hornsby-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  HORNSBY_PDF_URL,
  hornsbyExtraction,
  hornsbyPage6,
} from '../src/connectors/hornsby-gpfs/fixture-data.js';
import {
  HORNSBY_GPFS_CONTEXT,
  HORNSBY_GPFS_ROW_COUNT,
} from '../src/connectors/hornsby-gpfs/fixture.js';

// Hornsby's official Financial Statements page lists "Annual Financial
// Statements 2025/26" first. Its Income Statement prints the Original
// unaudited budget column first, the FY2025-26 Actual column second and the
// FY2024-25 column third, each row's label and amounts on the same printed
// line (wrapped labels span up to three rows). FY2025-26 has no discontinued
// operation, so the printed continuing operating result and the net result
// repeated in comprehensive income are the same. The B1-1 function expense
// split is a second cut of the same printed total expenses.

const CONTEXT: HornsbyGpfsParseContext = HORNSBY_GPFS_CONTEXT;

function parsedFixture() {
  return parseHornsbyGpfsExtraction(hornsbyExtraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

function mutatePage(page: PdfPage, from: string, to: string): PdfPage {
  return {
    ...page,
    text: page.text.split(from).join(to),
    items: page.items.map((entry) =>
      entry.str.includes(from) ? { ...entry, str: entry.str.split(from).join(to) } : entry,
    ),
  };
}

function extractionWith(pageNumber: number, mutate: (page: PdfPage) => PdfPage): PdfExtraction {
  const base = hornsbyExtraction();
  const pages = base.pages.map((page) => (page.page_number === pageNumber ? mutate(page) : page));
  return { ...base, pages, text: pages.map((page) => page.text).join('\n') };
}

describe('Hornsby Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <h1>Financial Statements</h1>
    <a href="/files/assets/public/v/1/documents/financial-statements/hornsby-shire-council-financial-statements-2023-24-with-cover-pages.pdf">Annual Financial Statements 2023/24(PDF, 10MB)</a>
    <a href="/files/assets/public/v/2/council/forms-and-publications/publications/financial-statements/documents/annual_financial_statements-2025-final-signed.pdf">Annual Financial Statements 2024/25(PDF, 2MB)</a>
    <a href="/files/assets/public/v/2/council/forms-and-publications/publications/financial-statements/documents/hsc8902-financial-statements-2026.pdf">Annual Financial Statements 2025/26(PDF, 5MB)</a>
  `;

  it('discovers the latest audited FY2025-26 statements from the official page, not a hard-coded PDF URL', () => {
    expect(parseHornsbyGpfsReportPage(pageHtml, HORNSBY_GPFS_REPORTING_URL, '2025-26')).toEqual({
      pdfUrl: HORNSBY_PDF_URL,
      title:
        'Hornsby Shire Council Annual Financial Statements 2025-26 (General Purpose Financial Statements)',
    });
    expect(fiscalYearFromHornsbyGpfsLink('Annual Financial Statements 2025/26')).toBe('2025-26');
    expect(fiscalYearFromHornsbyGpfsLink('Annual Financial Statements 2024/25')).toBe('2024-25');
    expect(fiscalYearFromHornsbyGpfsLink('hsc8902-financial-statements-2026.pdf')).toBe('2025-26');
  });

  it('resolves the PDF through the official Financial Statements HTML', async () => {
    const discovered = await discoverHornsbyGpfsDocument(globalThis.fetch, '2025-26', {
      listingHtml: pageHtml,
    });
    expect(discovered.title).toBe(
      'Hornsby Shire Council Annual Financial Statements 2025-26 (General Purpose Financial Statements)',
    );
    expect(discovered.url).toBe(HORNSBY_PDF_URL);
    expect(discovered.fiscal_year).toBe('2025-26');
    expect(discovered.listing_url).toBe(HORNSBY_GPFS_REPORTING_URL);
  });

  it('does not select a prior-year statement for the target year', () => {
    expect(
      parseHornsbyGpfsReportPage(
        `<a href="/files/docs/annual_financial_statements-2025-final-signed.pdf">Annual Financial Statements 2024/25</a>`,
        HORNSBY_GPFS_REPORTING_URL,
        '2025-26',
      ),
    ).toBeNull();
  });

  it('rejects a statements link on a non-council host', () => {
    expect(
      parseHornsbyGpfsReportPage(
        `<a href="https://example.com/annual_financial_statements-2026.pdf">Annual Financial Statements 2025/26</a>`,
        HORNSBY_GPFS_REPORTING_URL,
        '2025-26',
      ),
    ).toBeNull();
  });
});

describe('Hornsby Shire Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectHornsbyGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectHornsbyGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = mutatePage(hornsbyPage6(), "$ '000", '');
    const base = hornsbyExtraction();
    const pages = base.pages.map((page) => (page.page_number === 6 ? withoutUnit : page));
    const parsed = parseHornsbyGpfsExtraction(
      { ...base, pages, text: pages.map((page) => page.text).join('\n') },
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Hornsby Shire Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1, comprehensive income and note B3-3 exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(HORNSBY_GPFS_ROW_COUNT);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(207_011);
    expect(reconciliation.total_expenses).toBe(165_975);
    expect(reconciliation.employee_expenses).toBe(60_968);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(27_550);
    expect(reconciliation.government_grants_operating).toBe(13_663);
    expect(reconciliation.government_grants_capital).toBe(14_831);
    expect(reconciliation.borrowing_costs).toBe(29);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(1_909);
    expect(reconciliation.operating_result_continuing).toBe(41_036);
    expect(reconciliation.net_result).toBe(41_036);
    expect(reconciliation.operating_result_excluding_depreciation).toBe(68_586);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(138_425);
    expect(reconciliation.net_result_before_capital_grants).toBe(26_205);
    expect(reconciliation.revenue_components_sum).toBe(207_011);
    expect(reconciliation.expense_components_sum).toBe(138_425);
    expect(reconciliation.face_expense_bridge).toBe(165_975);
    expect(reconciliation.functions_total_income).toBe(207_011);
    expect(reconciliation.functions_total_expenses).toBe(165_975);
    expect(reconciliation.functions_operating_result).toBe(41_036);
    expect(reconciliation.functions_grants_and_contributions).toBe(28_494);
    expect(reconciliation.functions_expense_split_sum).toBe(165_975);
    expect(reconciliation.comprehensive_income_net_result).toBe(41_036);
    expect(reconciliation.comprehensive_income_other).toBe(10_874);
    expect(reconciliation.comprehensive_income_total).toBe(51_910);
    expect(reconciliation.depreciation_impairment_note_total).toBe(27_550);
    expect(reconciliation.income_statement_page).toBe(6);
    expect(reconciliation.functions_page).toBe(15);
    expect(reconciliation.comprehensive_income_page).toBe(7);
    expect(reconciliation.depreciation_note_page).toBe(24);
    expect(reconciliation.checks.length).toBeGreaterThan(10);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(20_701_100_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(16_597_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(6_096_800_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_755_000_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_366_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_483_100_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(2_900_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      190_900_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(4_103_600_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      13_842_500_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(13_588_600_000);
    expect(
      recordByLine(records, 'b1_1_function_expenses_general_managers_division').amount_cents,
    ).toBe(926_900_000);
    expect(recordByLine(records, 'b1_1_function_expenses_corporate_support').amount_cents).toBe(
      3_877_500_000,
    );
    expect(
      recordByLine(records, 'b1_1_function_expenses_infrastructure_and_major_projects')
        .amount_cents,
    ).toBe(2_895_000_000);
    expect(
      recordByLine(records, 'b1_1_function_expenses_community_and_environment').amount_cents,
    ).toBe(7_442_000_000);
    expect(recordByLine(records, 'b1_1_function_expenses_planning').amount_cents).toBe(
      1_456_100_000,
    );
  });

  it('emits only printed categories: components point at their printed subtotal and there is no region/LGA allocation', () => {
    const { records } = parsedFixture();
    const keys = records.map((record) => record.gpfs_line_item).sort();
    expect(keys).toEqual(
      [
        'b1_1_function_expenses_community_and_environment',
        'b1_1_function_expenses_corporate_support',
        'b1_1_function_expenses_general_managers_division',
        'b1_1_function_expenses_infrastructure_and_major_projects',
        'b1_1_function_expenses_planning',
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
        source_id: HORNSBY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: HORNSBY_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Hornsby Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Hornsby Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^hornsby-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'employee_expenses').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'depreciation_amortisation_impairment').gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(recordByLine(records, 'b1_1_function_expenses_planning').gpfs_component_of).toBe(
      'b1_1_total_expenses',
    );
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const parsed = parseHornsbyGpfsExtraction(
      extractionWith(15, (page) => mutatePage(page, '165,975', '165,985')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const parsed = parseHornsbyGpfsExtraction(
      extractionWith(6, (page) => mutatePage(page, '135,886', '135,986')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a B1-1 function expense row no longer sums to the total', () => {
    const parsed = parseHornsbyGpfsExtraction(
      extractionWith(15, (page) => mutatePage(page, '9,269', '9,169')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const parsed = parseHornsbyGpfsExtraction(
      extractionWith(7, (page) => mutatePage(page, '51,910', '51,990')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-3 depreciation no longer bridges', () => {
    const parsed = parseHornsbyGpfsExtraction(
      extractionWith(24, (page) => mutatePage(page, '27,550', '27,650')),
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
    const identity = CONTEXT.archive.sha256;
    const revenue = hornsbyGpfsNaturalKey(identity, 'total_revenue', '2025-26');
    const expenses = hornsbyGpfsNaturalKey(identity, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^hornsby-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(hornsbyGpfsNaturalKey(identity, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(hornsbyGpfsNaturalKey(identity, 'total_revenue', '2026-27'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_hornsbygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: HORNSBY_GPFS_ID,
    name: HORNSBY_GPFS_NAME,
    publisher: HORNSBY_GPFS_PUBLISHER,
    source_url: HORNSBY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: HORNSBY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'hornsby-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Hornsby Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: HORNSBY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-hornsby-shire-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Hornsby Shire Council',
        delivery_entity: 'Hornsby Shire Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-HORNSBY-SHIRE-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase HORNSBY SHIRE COUNCIL',
        delivery_entity: 'HORNSBY SHIRE COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-hornsby-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Hornsby Community Services Incorporated',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'ku-ring-gai-gpfs',
        source_url: 'https://www.krg.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-ku-ring-gai-gpfs-1',
        project_name: 'Existing Ku-ring-gai Council GPFS row',
        delivery_entity: 'Ku-ring-gai Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-hornsby-project',
        project_name: 'Existing NSW Budget project whose name mentions Hornsby',
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
    const before = await MeasureModel.countDocuments({});

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'ku-ring-gai-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: HORNSBY_GPFS_ID })).toBe(
      HORNSBY_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(before + HORNSBY_GPFS_ROW_COUNT);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: HORNSBY_GPFS_ID })).toBe(
      HORNSBY_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(before + HORNSBY_GPFS_ROW_COUNT);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Hornsby Shire Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'HORNSBY SHIRE COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Hornsby Shire Council' })).toBe(
      HORNSBY_GPFS_ROW_COUNT + 1,
    );
    expect(await MeasureModel.countDocuments({ delivery_entity: /^hornsby shire council$/i })).toBe(
      HORNSBY_GPFS_ROW_COUNT + 2,
    );

    expect(
      await MeasureModel.countDocuments({
        source_id: HORNSBY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: HORNSBY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: HORNSBY_GPFS_ID,
        delivery_entity: { $ne: 'Hornsby Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: HORNSBY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(HORNSBY_GPFS_ROW_COUNT);
  });
});
