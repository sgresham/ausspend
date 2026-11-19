import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BALLINA_GPFS_DELIVERY_ENTITY,
  BALLINA_GPFS_DOCUMENT_PIN,
  BALLINA_GPFS_FISCAL_YEAR,
  BALLINA_GPFS_ID,
  BALLINA_GPFS_LICENSE,
  BALLINA_GPFS_NAME,
  BALLINA_GPFS_PUBLISHER,
  BALLINA_GPFS_REPORTING_URL,
  BALLINA_GPFS_REQUEST_HEADERS,
  ballinaGpfsNaturalKey,
  ballinaPinnedDocument,
  detectBallinaGpfsUnit,
  discoverBallinaGpfsDocument,
  fiscalYearFromBallinaGpfsLink,
  parseBallinaGpfsExtraction,
  parseBallinaGpfsReportLinks,
  selectBallinaGpfsDocument,
} from '../src/connectors/ballina-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  BALLINA_COMPREHENSIVE_TEXT,
  BALLINA_CONTEXT,
  BALLINA_FUNCTIONS_TEXT,
  BALLINA_INCOME_TEXT,
  BALLINA_PDF_SHA256,
  BALLINA_PDF_URL,
  ballinaExtraction,
} from '../src/connectors/ballina-gpfs/fixture.js';

// Ballina Shire Council's audited FY2024-25 General Purpose Financial Statements,
// embedded in the official Annual Report 2024-25 (GPFS PDF pp. 216, 217 and 225).
// The Reporting page lists Annual Report 2024-25 as the latest annual report as
// at 2026-11-19; no FY2025-26 annual report was published. The Income Statement
// prints the Original unaudited budget column before the line label, with Actual
// 2025 and Actual 2024 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2025. Ballina prints
// eight revenue components including "Other income" and a real net gain on
// disposal of assets of 9,849, plus four expense components (the 2025 net loss on
// disposal is nil; the 2024 comparative is 6,707). The net result is positive
// (31,500) and the before-capital result is also positive (9,245). Other
// comprehensive income prints revaluation 203,585 and impairment reversal 654,
// summing to the printed 204,239.

function parsedFixture() {
  return parseBallinaGpfsExtraction(ballinaExtraction(), BALLINA_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Ballina Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/2/council/documents/council-documents/ballina-shire-council-annual-report-202425-resized.pdf">Annual Report 2024-25 (PDF,&nbsp;16MB)</a>
    <a href="/files/assets/public/v/1/council/documents/council-documents/state-of-the-ballina-shire-report-2022-2024_1.pdf">State of the Ballina Shire Report 2022-2024 (PDF,&nbsp;15MB)</a>
    <a href="/Council/Forms-and-Documents/Integrated-Planning-and-Reporting/Planning-and-Delivery/Previous-Integrated-Planning-and-Reporting-documents">View previous Reports</a>
    <a href="https://example.com/ballina-shire-council-annual-report-202425-resized.pdf">Ballina annual report mirror</a>
  `;

  it('discovers the FY2024-25 annual report containing the audited GPFS and selects it', () => {
    expect(BALLINA_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseBallinaGpfsReportLinks(pageHtml, BALLINA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(links.map((link) => link.url)).toEqual([BALLINA_PDF_URL]);
    const selected = selectBallinaGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(BALLINA_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(BALLINA_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Annual Report 2024-25');
    expect(fiscalYearFromBallinaGpfsLink('Annual Report 2024-25')).toBe('2024-25');
    expect(fiscalYearFromBallinaGpfsLink('Annual Report 2023-2024')).toBe('2023-24');
    expect(
      fiscalYearFromBallinaGpfsLink('Financial Statements for the year ended 30 June 2025'),
    ).toBe('2024-25');
    expect(fiscalYearFromBallinaGpfsLink('Long Term Financial Plan 2023-2033.pdf')).toBeNull();
  });

  it('rejects a prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/2/council/documents/council-documents/ballina-shire-council-annual-report-202324-resized.pdf">Annual Report 2023-24 (PDF,&nbsp;16MB)</a>
    `;
    const links = parseBallinaGpfsReportLinks(priorOnly, BALLINA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectBallinaGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 annual report for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/2/council/documents/council-documents/ballina-shire-council-annual-report-202526-resized.pdf">Annual Report 2025-26 (PDF,&nbsp;16MB)</a>
    `;
    const links = parseBallinaGpfsReportLinks(futureOnly, BALLINA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectBallinaGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseBallinaGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      BALLINA_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = ballinaPinnedDocument();
    expect(pinned.url).toBe(BALLINA_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('ballina-shire-council-annual-report-202425-resized.pdf');
    const discovered = await discoverBallinaGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(BALLINA_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverBallinaGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(BALLINA_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(BALLINA_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverBallinaGpfsDocument(
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
      discoverBallinaGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Ballina Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectBallinaGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectBallinaGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = BALLINA_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseBallinaGpfsExtraction(
      extraction({ income: withoutUnit }),
      BALLINA_CONTEXT,
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
    source: { sha256: BALLINA_PDF_SHA256, bytes: 17_070_707 },
    pages: [
      pdfPage(overrides.income ?? BALLINA_INCOME_TEXT, 216),
      pdfPage(overrides.comprehensive ?? BALLINA_COMPREHENSIVE_TEXT, 217),
      pdfPage(overrides.functions ?? BALLINA_FUNCTIONS_TEXT, 225),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Ballina Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(157_649);
    expect(reconciliation.total_expenses).toBe(126_149);
    expect(reconciliation.employee_expenses).toBe(38_505);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(30_610);
    expect(reconciliation.government_grants_operating).toBe(11_690);
    expect(reconciliation.government_grants_capital).toBe(22_255);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(9_849);
    expect(reconciliation.net_result).toBe(31_500);
    expect(reconciliation.net_result_before_capital_grants).toBe(9_245);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(95_539);
    expect(reconciliation.face_expense_bridge).toBe(126_149);
    expect(reconciliation.functions_total_income).toBe(157_649);
    expect(reconciliation.functions_total_expenses).toBe(126_149);
    expect(reconciliation.functions_operating_result).toBe(31_500);
    expect(reconciliation.functions_grants_and_contributions).toBe(33_945);
    expect(reconciliation.comprehensive_income_net_result).toBe(31_500);
    expect(reconciliation.comprehensive_other_income).toBe(204_239);
    expect(reconciliation.comprehensive_total).toBe(235_739);
    expect(reconciliation.comprehensive_revaluation).toBe(203_585);
    expect(reconciliation.comprehensive_impairment_reversal).toBe(654);
    expect(reconciliation.revenue_components_sum).toBe(157_649);
    expect(reconciliation.expense_components_sum).toBe(95_539);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(15_764_900_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(12_614_900_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(3_850_500_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      3_061_000_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_169_000_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(2_225_500_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      984_900_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(406_700_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(6_502_000_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(343_100_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(578_400_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      541_000_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(327_700_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(4_969_000_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(3_421_000_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(3_150_000_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_loss_from_disposal_of_assets'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: BALLINA_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: BALLINA_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Ballina Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: BALLINA_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Ballina Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^ballina-gpfs:/);
      expect(record.source_url).toContain('ballina-shire-council-annual-report-202425-resized.pdf');
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
    expect(revenueComponents).toHaveLength(8);
    expect(revenueComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalRevenue.amount_cents,
    );

    const expensesExDepreciation = recordByLine(records, 'total_expenses_excluding_depreciation');
    const natureComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses_excluding_depreciation',
    );
    expect(natureComponents).toHaveLength(4);
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
    expect(records.every((record) => record.jurisdiction_level === 'local')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = BALLINA_FUNCTIONS_TEXT.replace(
      'Total functions and activities 157,649 156,884 126,149 123,463',
      'Total functions and activities 157,649 156,884 126,151 123,463',
    );
    const parsed = parseBallinaGpfsExtraction(extraction({ functions: broken }), BALLINA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = BALLINA_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 235,739',
      'Total comprehensive income for the year attributable to Council 235,741',
    );
    const parsed = parseBallinaGpfsExtraction(
      extraction({ comprehensive: broken }),
      BALLINA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = BALLINA_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 65,020',
      'Rates and annual charges B2-1 65,022',
    );
    const parsed = parseBallinaGpfsExtraction(extraction({ income: broken }), BALLINA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net gain on disposal is altered', () => {
    const broken = BALLINA_INCOME_TEXT.replace(
      'Net gain from the disposal of assets B4-1 9,849',
      'Net gain from the disposal of assets B4-1 9,851',
    );
    const parsed = parseBallinaGpfsExtraction(extraction({ income: broken }), BALLINA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the impairment reversal OCI component is altered', () => {
    const broken = BALLINA_COMPREHENSIVE_TEXT.replace(
      'Impairment reversal relating to infrastructure, property, plant and equipment C1-8 654 279',
      'Impairment reversal relating to infrastructure, property, plant and equipment C1-8 656 279',
    );
    const parsed = parseBallinaGpfsExtraction(
      extraction({ comprehensive: broken }),
      BALLINA_CONTEXT,
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
    const url = BALLINA_CONTEXT.document.url;
    const revenue = ballinaGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = ballinaGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^ballina-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(ballinaGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(ballinaGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_ballinagpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BALLINA_GPFS_ID,
    name: BALLINA_GPFS_NAME,
    publisher: BALLINA_GPFS_PUBLISHER,
    source_url: BALLINA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BALLINA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'ballina-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Ballina Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: BALLINA_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-ballina',
        project_name: 'Existing AusTender Ballina contract',
        delivery_entity: 'BALLINA SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-ballina',
        project_name: 'Existing GrantConnect Ballina grant',
        delivery_entity: 'Ballina Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-ballina-school',
        project_name: 'Existing data.nsw Ballina school row (not a council row)',
        delivery_entity: 'Ballina High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-ballina-charity',
        project_name: 'Existing ACNC Ballina charity row (not the council)',
        delivery_entity: 'Ballina Community Centre Inc',
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
    expect(records).toHaveLength(17);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'edward-river-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: BALLINA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BALLINA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: BALLINA_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BALLINA_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BALLINA_GPFS_ID,
        delivery_entity: { $ne: 'Ballina Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: BALLINA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
