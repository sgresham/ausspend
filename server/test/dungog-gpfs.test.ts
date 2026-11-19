import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  DUNGOG_GPFS_DELIVERY_ENTITY,
  DUNGOG_GPFS_DOCUMENT_PIN,
  DUNGOG_GPFS_FISCAL_YEAR,
  DUNGOG_GPFS_ID,
  DUNGOG_GPFS_LICENSE,
  DUNGOG_GPFS_NAME,
  DUNGOG_GPFS_PUBLISHER,
  DUNGOG_GPFS_REPORTING_URL,
  DUNGOG_GPFS_REQUEST_HEADERS,
  dungogPinnedDocument,
  detectDungogGpfsUnit,
  discoverDungogGpfsDocument,
  fiscalYearFromDungogGpfsLink,
  parseDungogGpfsExtraction,
  parseDungogGpfsReportLinks,
  selectDungogGpfsDocument,
  dungogGpfsNaturalKey,
} from '../src/connectors/dungog-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  DUNGOG_COMPREHENSIVE_TEXT,
  DUNGOG_CONTEXT,
  DUNGOG_FUNCTIONS_TEXT,
  DUNGOG_INCOME_TEXT,
  DUNGOG_PDF_SHA256,
  DUNGOG_PDF_URL,
  dungogExtraction,
} from '../src/connectors/dungog-gpfs/fixture.js';

// Dungog Shire Council's audited FY2024-25 standalone General Purpose
// Financial Statements. FY2024-25 is the latest obtainable audited year: no
// FY2025-26 audited standalone statements are published on the official Annual
// Report 2024-2025 page as at 2026-11-19. The connector targets 2024-25 only and
// never substitutes 2025-26/2023-24. The Income Statement prints the Original
// unaudited budget column before the line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025. Dungog prints seven revenue
// components (2025 net gain on disposal nil) and five expense components
// including a real net loss on disposal of 3,779. The net result is positive
// (6,802) while the before-capital result is negative (-15,750). Other
// comprehensive income prints a single 2025 revaluation component of 17,409.

function parsedFixture() {
  return parseDungogGpfsExtraction(dungogExtraction(), DUNGOG_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Dungog Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/councildocuments/annual_reports/2024-2025/annual-financial-statements-2025-final-version.pdf">Annual Financial Statements 2024-2025 (PDF,&nbsp;3MB)</a>
    <a href="/files/assets/public/v/1/councildocuments/annual_reports/2024-2025/public-notice-–_presentation-of-financial_-statements-2025.pdf">Public-Notice-–_Presentation-of-Financial_-Statements-2025.pdf (PDF,&nbsp;119KB)</a>
    <a href="/files/assets/public/v/1/councildocuments/annual_reports/2024-2025/annual-report-2024-25-amended-v2-printed-14-jan-26.pdf">Annual-Report-2024-25-Amended-v2-Printed-14-Jan-26.pdf (PDF,&nbsp;5MB)</a>
    <a href="https://example.com/annual-financial-statements-2025-final-version.pdf">Dungog financial statements mirror</a>
  `;

  it('discovers the FY2024-25 standalone statements and never the annual report, prior year or a mirror', () => {
    expect(DUNGOG_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseDungogGpfsReportLinks(pageHtml, DUNGOG_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(links.map((link) => link.url)).toEqual([DUNGOG_PDF_URL]);
    const selected = selectDungogGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(DUNGOG_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(DUNGOG_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Annual Financial Statements 2024-2025');
    expect(
      fiscalYearFromDungogGpfsLink('Annual Financial Statements 2024-2025'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromDungogGpfsLink('annual-financial-statements-2023-2024.pdf'),
    ).toBe('2023-24');
    expect(
      fiscalYearFromDungogGpfsLink(
        'Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromDungogGpfsLink('Long Term Financial Plan 2023-2033.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/councildocuments/annual_reports/2023-2024/annual-financial-statements-2023-2024.pdf">Annual Financial Statements 2023-2024 (PDF,&nbsp;3MB)</a>
    `;
    const links = parseDungogGpfsReportLinks(priorOnly, DUNGOG_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectDungogGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/councildocuments/annual_reports/2025-2026/annual-financial-statements-2025-2026.pdf">Annual Financial Statements 2025-2026 (PDF,&nbsp;3MB)</a>
    `;
    const links = parseDungogGpfsReportLinks(futureOnly, DUNGOG_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectDungogGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseDungogGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      DUNGOG_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = dungogPinnedDocument();
    expect(pinned.url).toBe(DUNGOG_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('annual-financial-statements-2025-final-version.pdf');
    const discovered = await discoverDungogGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(DUNGOG_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverDungogGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(DUNGOG_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(DUNGOG_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverDungogGpfsDocument(
      (async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenHeaders = init?.headers as Record<string, string>;
        return new Response('<html>no links</html>', { status: 200 });
      }) as typeof fetch,
      '2024-25',
    );
    expect(seenHeaders?.['user-agent']).toBe('curl/8.5.0');
    expect(seenHeaders?.['user-agent']).not.toContain('Chrome');
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverDungogGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Dungog Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectDungogGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectDungogGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = DUNGOG_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseDungogGpfsExtraction(
      extraction({ income: withoutUnit }),
      DUNGOG_CONTEXT,
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
    source: { sha256: DUNGOG_PDF_SHA256, bytes: 2_733_768 },
    pages: [
      pdfPage(overrides.income ?? DUNGOG_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? DUNGOG_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? DUNGOG_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Dungog Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(44_415);
    expect(reconciliation.total_expenses).toBe(37_613);
    expect(reconciliation.employee_expenses).toBe(8_628);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(9_882);
    expect(reconciliation.government_grants_operating).toBe(4_918);
    expect(reconciliation.government_grants_capital).toBe(22_552);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(3_779);
    expect(reconciliation.net_result).toBe(6_802);
    expect(reconciliation.net_result_before_capital_grants).toBe(-15_750);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(27_731);
    expect(reconciliation.face_expense_bridge).toBe(37_613);
    expect(reconciliation.functions_total_income).toBe(44_415);
    expect(reconciliation.functions_total_expenses).toBe(37_613);
    expect(reconciliation.functions_operating_result).toBe(6_802);
    expect(reconciliation.functions_grants_and_contributions).toBe(27_470);
    expect(reconciliation.comprehensive_income_net_result).toBe(6_802);
    expect(reconciliation.comprehensive_other_income).toBe(17_409);
    expect(reconciliation.comprehensive_total).toBe(24_211);
    expect(reconciliation.comprehensive_revaluation).toBe(17_409);
    expect(reconciliation.revenue_components_sum).toBe(44_415);
    expect(reconciliation.expense_components_sum).toBe(27_731);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(4_441_500_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_761_300_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(862_800_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      988_200_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(491_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(2_255_200_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      377_900_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(145_800_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_333_300_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(99_800_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(19_100_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      105_200_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(120_400_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(1_266_200_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(137_100_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(680_200_000);
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
        source_id: DUNGOG_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: DUNGOG_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Dungog Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: DUNGOG_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Dungog Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^dungog-gpfs:/);
      expect(record.source_url).toContain('annual-financial-statements-2025-final-version.pdf');
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
    const broken = DUNGOG_FUNCTIONS_TEXT.replace(
      'Total functions and activities 44,415 43,376 37,613 30,438',
      'Total functions and activities 44,415 43,376 37,615 30,438',
    );
    const parsed = parseDungogGpfsExtraction(
      extraction({ functions: broken }),
      DUNGOG_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = DUNGOG_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 24,211',
      'Total comprehensive income for the year attributable to Council 24,213',
    );
    const parsed = parseDungogGpfsExtraction(
      extraction({ comprehensive: broken }),
      DUNGOG_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = DUNGOG_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 13,333',
      'Rates and annual charges B2-1 13,335',
    );
    const parsed = parseDungogGpfsExtraction(extraction({ income: broken }), DUNGOG_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = DUNGOG_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 3,779',
      'Net loss from the disposal of assets B4-1 3,781',
    );
    const parsed = parseDungogGpfsExtraction(extraction({ income: broken }), DUNGOG_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the OCI component is altered', () => {
    const broken = DUNGOG_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 17,409 30,047',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 17,411 30,047',
    );
    const parsed = parseDungogGpfsExtraction(
      extraction({ comprehensive: broken }),
      DUNGOG_CONTEXT,
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
    const url = DUNGOG_CONTEXT.document.url;
    const revenue = dungogGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = dungogGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^dungog-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(dungogGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(dungogGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_dungoggpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: DUNGOG_GPFS_ID,
    name: DUNGOG_GPFS_NAME,
    publisher: DUNGOG_GPFS_PUBLISHER,
    source_url: DUNGOG_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: DUNGOG_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'dungog-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Dungog Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: DUNGOG_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-dungog',
        project_name: 'Existing AusTender Dungog contract',
        delivery_entity: 'DUNGOG SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-dungog',
        project_name: 'Existing GrantConnect Dungog grant',
        delivery_entity: 'Dungog Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-dungog-school',
        project_name: 'Existing data.nsw Dungog school row (not a council row)',
        delivery_entity: 'Dungog High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-dungog-charity',
        project_name: 'Existing ACNC Dungog charity row (not the council)',
        delivery_entity: 'Dungog Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'edward-river-gpfs',
        source_url: 'https://www.edwardriver.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-edward-river-gpfs-1',
        project_name: 'Existing Edward River GPFS row',
        delivery_entity: 'Edward River Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'edward-river-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: DUNGOG_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: DUNGOG_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: DUNGOG_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: DUNGOG_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: DUNGOG_GPFS_ID,
        delivery_entity: { $ne: 'Dungog Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: DUNGOG_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
