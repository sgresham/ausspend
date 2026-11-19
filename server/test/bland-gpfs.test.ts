import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BLAND_GPFS_DELIVERY_ENTITY,
  BLAND_GPFS_DOCUMENT_PIN,
  BLAND_GPFS_FISCAL_YEAR,
  BLAND_GPFS_ID,
  BLAND_GPFS_LICENSE,
  BLAND_GPFS_NAME,
  BLAND_GPFS_PUBLISHER,
  BLAND_GPFS_REPORTING_URL,
  BLAND_GPFS_REQUEST_HEADERS,
  blandPinnedDocument,
  detectBlandGpfsUnit,
  discoverBlandGpfsDocument,
  fiscalYearFromBlandGpfsLink,
  parseBlandGpfsExtraction,
  parseBlandGpfsReportLinks,
  selectBlandGpfsDocument,
  blandGpfsNaturalKey,
} from '../src/connectors/bland-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  BLAND_COMPREHENSIVE_TEXT,
  BLAND_CONTEXT,
  BLAND_FUNCTIONS_TEXT,
  BLAND_INCOME_TEXT,
  BLAND_PDF_SHA256,
  BLAND_PDF_URL,
  blandExtraction,
} from '../src/connectors/bland-gpfs/fixture.js';

// Bland Shire Council's audited FY2024-25 standalone General Purpose
// Financial Statements. FY2024-25 is the latest obtainable audited year: no
// FY2025-26 audited standalone statements are published on the official Finance
// page as at 2026-11-19. The connector targets 2024-25 only and never
// substitutes 2025-26/2023-24. The Income Statement prints the Original
// unaudited budget column before the line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025. Bland prints seven revenue
// components (2025 net gain on disposal nil) and five expense components
// including a real net loss on disposal of 866. The net result is positive
// (10,499) and the before-capital result is also positive (4,751). Other
// comprehensive income prints revaluation 21,980 and joint ventures/associates
// 38, summing to the printed 22,018.

function parsedFixture() {
  return parseBlandGpfsExtraction(blandExtraction(), BLAND_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Bland Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/sharedassets/public/v/1/finance/annual_financial_statements-2025.pdf">Annual Financial Statements 2024-2025 (PDF,&nbsp;3MB)</a>
    <a href="/files/sharedassets/public/v/1/annual-financial-statements/annual_financial_statements-2024.pdf">Annual Financial Statements 2023-2024 (PDF,&nbsp;4MB)</a>
    <a href="/files/sharedassets/public/v/1/annual-financial-statements/annual_financial_statements-2023.pdf">Annual_Financial_Statements-2023.pdf (PDF,&nbsp;4MB)</a>
    <a href="/files/sharedassets/public/v/1/annual-financial-statements/annual_financial_statements_notepn_public_notice_–_presentation_of_financial_statements.pdf">Annual_Financial_Statements_NotePN_Public_Notice_–_Presentation_of_Financial_Statements.pdf (PDF,&nbsp;116KB)</a>
    <a href="/files/sharedassets/public/v/1/annual-financial-statements/annual-report-2024-25-adopted-1.pdf">Annual Report 2024-2025 (PDF,&nbsp;10MB)</a>
    <a href="https://example.com/annual_financial_statements-2025.pdf">Bland financial statements mirror</a>
  `;

  it('discovers the FY2024-25 standalone statements and never the annual report, prior year or a mirror', () => {
    expect(BLAND_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseBlandGpfsReportLinks(pageHtml, BLAND_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24', '2022-23']);
    expect(links.map((link) => link.url)).toEqual([
      BLAND_PDF_URL,
      'https://www.blandshire.nsw.gov.au/files/sharedassets/public/v/1/annual-financial-statements/annual_financial_statements-2024.pdf',
      'https://www.blandshire.nsw.gov.au/files/sharedassets/public/v/1/annual-financial-statements/annual_financial_statements-2023.pdf',
    ]);
    const selected = selectBlandGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(BLAND_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(BLAND_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Annual Financial Statements 2024-2025');
    expect(
      fiscalYearFromBlandGpfsLink('Annual Financial Statements 2024-2025'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromBlandGpfsLink('annual-financial-statements-2023-2024.pdf'),
    ).toBe('2023-24');
    expect(
      fiscalYearFromBlandGpfsLink(
        'Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromBlandGpfsLink('Long Term Financial Plan 2023-2033.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="/files/sharedassets/public/v/1/annual-financial-statements/annual_financial_statements-2024.pdf">Annual Financial Statements 2023-2024 (PDF,&nbsp;4MB)</a>
    `;
    const links = parseBlandGpfsReportLinks(priorOnly, BLAND_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectBlandGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="/files/sharedassets/public/v/1/finance/annual_financial_statements-2025-2026.pdf">Annual Financial Statements 2025-2026 (PDF,&nbsp;3MB)</a>
    `;
    const links = parseBlandGpfsReportLinks(futureOnly, BLAND_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectBlandGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseBlandGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      BLAND_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = blandPinnedDocument();
    expect(pinned.url).toBe(BLAND_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('annual_financial_statements-2025.pdf');
    const discovered = await discoverBlandGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(BLAND_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverBlandGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(BLAND_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(BLAND_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverBlandGpfsDocument(
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
      discoverBlandGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Bland Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectBlandGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectBlandGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = BLAND_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseBlandGpfsExtraction(
      extraction({ income: withoutUnit }),
      BLAND_CONTEXT,
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
    source: { sha256: BLAND_PDF_SHA256, bytes: 2_771_199 },
    pages: [
      pdfPage(overrides.income ?? BLAND_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? BLAND_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? BLAND_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Bland Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(39_266);
    expect(reconciliation.total_expenses).toBe(28_767);
    expect(reconciliation.employee_expenses).toBe(9_266);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(8_942);
    expect(reconciliation.government_grants_operating).toBe(10_421);
    expect(reconciliation.government_grants_capital).toBe(5_748);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(866);
    expect(reconciliation.net_result).toBe(10_499);
    expect(reconciliation.net_result_before_capital_grants).toBe(4_751);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(19_825);
    expect(reconciliation.face_expense_bridge).toBe(28_767);
    expect(reconciliation.functions_total_income).toBe(39_266);
    expect(reconciliation.functions_total_expenses).toBe(28_767);
    expect(reconciliation.functions_operating_result).toBe(10_499);
    expect(reconciliation.functions_grants_and_contributions).toBe(16_169);
    expect(reconciliation.comprehensive_income_net_result).toBe(10_499);
    expect(reconciliation.comprehensive_other_income).toBe(22_018);
    expect(reconciliation.comprehensive_total).toBe(32_517);
    expect(reconciliation.comprehensive_revaluation).toBe(21_980);
    expect(reconciliation.comprehensive_other_movements).toBe(38);
    expect(reconciliation.revenue_components_sum).toBe(39_266);
    expect(reconciliation.expense_components_sum).toBe(19_825);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(3_926_600_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(2_876_700_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(926_600_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      894_200_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_042_100_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(574_800_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      86_600_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(28_600_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_132_200_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(77_600_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(539_800_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      432_100_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(87_000_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(853_700_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(128_000_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_049_900_000);
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
        source_id: BLAND_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: BLAND_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Bland Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: BLAND_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Bland Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^bland-gpfs:/);
      expect(record.source_url).toContain('annual_financial_statements-2025.pdf');
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
    const broken = BLAND_FUNCTIONS_TEXT.replace(
      'Total functions and activities 39,266 53,518 28,767 30,371',
      'Total functions and activities 39,266 53,518 28,769 30,371',
    );
    const parsed = parseBlandGpfsExtraction(
      extraction({ functions: broken }),
      BLAND_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = BLAND_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 32,517',
      'Total comprehensive income for the year attributable to Council 32,519',
    );
    const parsed = parseBlandGpfsExtraction(
      extraction({ comprehensive: broken }),
      BLAND_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = BLAND_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 11,322',
      'Rates and annual charges B2-1 11,324',
    );
    const parsed = parseBlandGpfsExtraction(extraction({ income: broken }), BLAND_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = BLAND_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 866',
      'Net loss from the disposal of assets B4-1 868',
    );
    const parsed = parseBlandGpfsExtraction(extraction({ income: broken }), BLAND_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when an OCI component is altered', () => {
    const broken = BLAND_COMPREHENSIVE_TEXT.replace(
      'Other comprehensive income – joint ventures and associates D2-2 38 233',
      'Other comprehensive income – joint ventures and associates D2-2 40 233',
    );
    const parsed = parseBlandGpfsExtraction(
      extraction({ comprehensive: broken }),
      BLAND_CONTEXT,
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
    const url = BLAND_CONTEXT.document.url;
    const revenue = blandGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = blandGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^bland-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(blandGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(blandGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_blandgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BLAND_GPFS_ID,
    name: BLAND_GPFS_NAME,
    publisher: BLAND_GPFS_PUBLISHER,
    source_url: BLAND_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BLAND_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'bland-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Bland Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: BLAND_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-bland',
        project_name: 'Existing AusTender Bland contract',
        delivery_entity: 'BLAND SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-bland',
        project_name: 'Existing GrantConnect Bland grant',
        delivery_entity: 'Bland Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-bland-school',
        project_name: 'Existing data.nsw Bland school row (not a council row)',
        delivery_entity: 'Bland High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-bland-charity',
        project_name: 'Existing ACNC Bland charity row (not the council)',
        delivery_entity: 'Bland Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: BLAND_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BLAND_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: BLAND_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BLAND_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BLAND_GPFS_ID,
        delivery_entity: { $ne: 'Bland Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: BLAND_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
