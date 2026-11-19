import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  COWRA_GPFS_DELIVERY_ENTITY,
  COWRA_GPFS_DOCUMENT_PIN,
  COWRA_GPFS_FISCAL_YEAR,
  COWRA_GPFS_ID,
  COWRA_GPFS_LICENSE,
  COWRA_GPFS_NAME,
  COWRA_GPFS_PUBLISHER,
  COWRA_GPFS_REPORTING_URL,
  COWRA_GPFS_REQUEST_HEADERS,
  cowraPinnedDocument,
  detectCowraGpfsUnit,
  discoverCowraGpfsDocument,
  fiscalYearFromCowraGpfsLink,
  parseCowraGpfsExtraction,
  parseCowraGpfsReportLinks,
  selectCowraGpfsDocument,
  cowraGpfsNaturalKey,
} from '../src/connectors/cowra-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COWRA_COMPREHENSIVE_TEXT,
  COWRA_CONTEXT,
  COWRA_FUNCTIONS_TEXT,
  COWRA_INCOME_TEXT,
  COWRA_PDF_SHA256,
  COWRA_PDF_URL,
  cowraExtraction,
} from '../src/connectors/cowra-gpfs/fixture.js';

// Cowra Shire Council's audited FY2025-26 standalone General Purpose Financial
// Statements. FY2025-26 is the current audited year (the item title originally
// said FY2024-25, but the official page publishes both and FY2025-26 is
// preferred). The connector targets 2025-26 only and never substitutes the
// prior 2024-25 or 2023-24 document. The Income Statement prints the Original
// unaudited budget column before the line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Cowra prints seven non-nil
// revenue components (the 2026 net gain on disposal is nil) and five expense
// components including a real net loss on disposal of 1,423. The net result is
// positive while the before-capital result is negative (-691). Other
// comprehensive income has a single non-nil component (revaluation 26,818); the
// 2026 impairment reversal is nil.

function parsedFixture() {
  return parseCowraGpfsExtraction(cowraExtraction(), COWRA_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Cowra Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/annual_financial_statements-2025-2026.pdf">Cowra Shire Council Annual Financial Statements 2025-2026</a>
    <a href="/files/assets/public/v/1/annual_financial_statements-2024-25.pdf">Cowra Shire Council Annual Financial Statements 2024-25</a>
    <a href="/files/assets/public/v/1/annual_financial_statements-2023-24.pdf">Cowra Shire Council Annual Financial Statements 2023-24</a>
    <a href="https://example.com/annual_financial_statements-2025-2026.pdf">Cowra financial statements mirror</a>
  `;

  it('discovers the FY2025-26 standalone statements and never the prior year or a mirror', () => {
    expect(COWRA_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseCowraGpfsReportLinks(pageHtml, COWRA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      COWRA_PDF_URL,
      'https://www.cowracouncil.com.au/files/assets/public/v/1/annual_financial_statements-2024-25.pdf',
      'https://www.cowracouncil.com.au/files/assets/public/v/1/annual_financial_statements-2023-24.pdf',
    ]);
    const selected = selectCowraGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(COWRA_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(COWRA_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Cowra Shire Council Annual Financial Statements 2025-2026');
    expect(fiscalYearFromCowraGpfsLink('annual_financial_statements-2025-2026.pdf')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromCowraGpfsLink('annual_financial_statements-2024-25.pdf')).toBe(
      '2024-25',
    );
    expect(
      fiscalYearFromCowraGpfsLink(
        'Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromCowraGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/annual_financial_statements-2024-25.pdf">Cowra Shire Council Annual Financial Statements 2024-25</a>
    `;
    const links = parseCowraGpfsReportLinks(priorOnly, COWRA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectCowraGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/annual_financial_statements-2026-2027.pdf">Cowra Shire Council Annual Financial Statements 2026-2027</a>
    `;
    const links = parseCowraGpfsReportLinks(futureOnly, COWRA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectCowraGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseCowraGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      COWRA_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = cowraPinnedDocument();
    expect(pinned.url).toBe(COWRA_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('annual_financial_statements-2025-2026.pdf');
    const discovered = await discoverCowraGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(COWRA_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverCowraGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(COWRA_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(COWRA_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverCowraGpfsDocument(
      (async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenHeaders = init?.headers as Record<string, string>;
        return new Response('<html>no links</html>', { status: 200 });
      }) as typeof fetch,
      '2025-26',
    );
    expect(seenHeaders?.['user-agent']).toBe('curl/8.5.0');
    expect(seenHeaders?.['user-agent']).not.toContain('Chrome');
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverCowraGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Cowra Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectCowraGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectCowraGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = COWRA_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseCowraGpfsExtraction(
      extraction({ income: withoutUnit }),
      COWRA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: COWRA_PDF_SHA256, bytes: 3_421_290 },
    pages: [
      pdfPage(overrides.income ?? COWRA_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? COWRA_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? COWRA_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Cowra Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(57_345);
    expect(reconciliation.total_expenses).toBe(54_714);
    expect(reconciliation.employee_expenses).toBe(19_228);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(10_921);
    expect(reconciliation.government_grants_operating).toBe(13_333);
    expect(reconciliation.government_grants_capital).toBe(3_322);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(1_423);
    expect(reconciliation.net_result).toBe(2_631);
    expect(reconciliation.net_result_before_capital_grants).toBe(-691);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(43_793);
    expect(reconciliation.face_expense_bridge).toBe(54_714);
    expect(reconciliation.functions_total_income).toBe(57_345);
    expect(reconciliation.functions_total_expenses).toBe(54_714);
    expect(reconciliation.functions_operating_result).toBe(2_631);
    expect(reconciliation.functions_grants_and_contributions).toBe(16_655);
    expect(reconciliation.comprehensive_income_net_result).toBe(2_631);
    expect(reconciliation.comprehensive_other_income).toBe(26_818);
    expect(reconciliation.comprehensive_total).toBe(29_449);
    expect(reconciliation.comprehensive_revaluation).toBe(26_818);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(57_345);
    expect(reconciliation.expense_components_sum).toBe(43_793);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(5_734_500_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(5_471_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_922_800_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_092_100_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_333_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(332_200_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      142_300_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(140_200_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_800_200_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(122_400_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(22_900_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      196_000_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(161_300_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(2_012_700_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(1_927_500_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(263_100_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_gain_from_disposal_of_assets'),
    ).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: COWRA_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: COWRA_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Cowra Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: COWRA_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Cowra Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^cowra-gpfs:/);
      expect(record.source_url).toContain('annual_financial_statements-2025-2026.pdf');
      expect(record.notes).not.toContain('document_resolved_url: ');
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
  });

  it('does not sum components with their printed totals and emits no council-total aggregate row', () => {
    const { records } = parsedFixture();
    const totalRevenue = recordByLine(records, 'total_revenue');
    const revenueComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_revenue',
    );
    expect(revenueComponents).toHaveLength(7);
    expect(revenueComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalRevenue.amount_cents,
    );

    const expensesExDepreciation = recordByLine(records, 'total_expenses_excluding_depreciation');
    const natureComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses_excluding_depreciation',
    );
    expect(natureComponents).toHaveLength(5);
    expect(natureComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      expensesExDepreciation.amount_cents,
    );

    const totalExpenses = recordByLine(records, 'total_expenses');
    const bridgeComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses',
    );
    expect(bridgeComponents).toHaveLength(2);
    expect(bridgeComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalExpenses.amount_cents,
    );

    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(
      records.every((record) =>
        ['revenue', 'expenses', 'result'].includes(String(record.gpfs_section)),
      ),
    ).toBe(true);
    expect(records.every((record) => record.jurisdiction_level === 'local')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = COWRA_FUNCTIONS_TEXT.replace(
      'Total functions and activities 57,345 52,169 54,714 48,087',
      'Total functions and activities 57,345 52,169 54,716 48,087',
    );
    const parsed = parseCowraGpfsExtraction(
      extraction({ functions: broken }),
      COWRA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = COWRA_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 29,449',
      'Total comprehensive income for the year attributable to Council 29,451',
    );
    const parsed = parseCowraGpfsExtraction(
      extraction({ comprehensive: broken }),
      COWRA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = COWRA_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 18,002',
      'Rates and annual charges B2-1 18,004',
    );
    const parsed = parseCowraGpfsExtraction(extraction({ income: broken }), COWRA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = COWRA_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 1,423',
      'Net loss from the disposal of assets B4-1 1,425',
    );
    const parsed = parseCowraGpfsExtraction(extraction({ income: broken }), COWRA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = COWRA_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 26,818',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 26,820',
    );
    const parsed = parseCowraGpfsExtraction(
      extraction({ comprehensive: broken }),
      COWRA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('is deterministic and derives stable, line-specific, fiscal-year-specific natural keys', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
    const url = COWRA_CONTEXT.document.url;
    const revenue = cowraGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = cowraGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^cowra-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(cowraGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(cowraGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_cowragpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: COWRA_GPFS_ID,
    name: COWRA_GPFS_NAME,
    publisher: COWRA_GPFS_PUBLISHER,
    source_url: COWRA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: COWRA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'cowra-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Cowra Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: COWRA_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-cowra',
        project_name: 'Existing AusTender Cowra contract',
        delivery_entity: 'COWRA SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-cowra',
        project_name: 'Existing GrantConnect Cowra grant',
        delivery_entity: 'Cowra Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-cowra-school',
        project_name: 'Existing data.nsw Cowra school row (not a council row)',
        delivery_entity: 'Cowra High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-cowra-charity',
        project_name: 'Existing ACNC Cowra charity row (not the council)',
        delivery_entity: 'Cowra Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'parkes-gpfs',
        source_url: 'https://www.parkes.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-parkes-gpfs-1',
        project_name: 'Existing Parkes GPFS row',
        delivery_entity: 'Parkes Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'parkes-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: COWRA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: COWRA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: COWRA_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: COWRA_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: COWRA_GPFS_ID,
        delivery_entity: { $ne: 'Cowra Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: COWRA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
