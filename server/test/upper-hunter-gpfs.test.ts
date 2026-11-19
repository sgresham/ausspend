import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  UPPER_HUNTER_GPFS_DELIVERY_ENTITY,
  UPPER_HUNTER_GPFS_DOCUMENT_PIN,
  UPPER_HUNTER_GPFS_FISCAL_YEAR,
  UPPER_HUNTER_GPFS_ID,
  UPPER_HUNTER_GPFS_LICENSE,
  UPPER_HUNTER_GPFS_NAME,
  UPPER_HUNTER_GPFS_PUBLISHER,
  UPPER_HUNTER_GPFS_REPORTING_URL,
  UPPER_HUNTER_GPFS_REQUEST_HEADERS,
  upperHunterPinnedDocument,
  detectUpperHunterGpfsUnit,
  discoverUpperHunterGpfsDocument,
  fiscalYearFromUpperHunterGpfsLink,
  parseUpperHunterGpfsExtraction,
  parseUpperHunterGpfsReportLinks,
  selectUpperHunterGpfsDocument,
  upperHunterGpfsNaturalKey,
} from '../src/connectors/upper-hunter-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  UPPER_HUNTER_COMPREHENSIVE_TEXT,
  UPPER_HUNTER_CONTEXT,
  UPPER_HUNTER_FUNCTIONS_TEXT,
  UPPER_HUNTER_INCOME_TEXT,
  UPPER_HUNTER_PDF_SHA256,
  UPPER_HUNTER_PDF_URL,
  upperHunterExtraction,
} from '../src/connectors/upper-hunter-gpfs/fixture.js';

// Upper Hunter Shire Council's audited FY2024-25 standalone General Purpose
// Financial Statements. FY2024-25 is the latest obtainable audited year: no
// FY2025-26 audited standalone statements are published as at 2026-11-19 (the
// page lists 2026 budget/planning and quarterly-review documents only). The
// connector targets 2024-25 only and never substitutes the later 2025-26 or the
// earlier 2023-24 document. The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2025 and Actual 2024 after
// it. A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. Upper Hunter prints seven revenue
// components (there is no net gain on disposal line) and five expense
// components including a real net loss on disposal of 4,221. The net result is
// positive while the before-capital result is negative. Other comprehensive
// income has a single component (revaluation 185,104). The council labels its
// totals "Total income" and "Total expenses" (the latter excludes depreciation).

function parsedFixture() {
  return parseUpperHunterGpfsExtraction(
    upperHunterExtraction(),
    UPPER_HUNTER_CONTEXT,
  );
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Upper Hunter Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/council/documents-and-policies/key-planning-documents/2025/annual_financial_statements-2025-final-signed-version.pdf">Annual Financial Statements 2025 final signed version</a>
    <a href="/files/assets/public/v/1/council/documents-and-policies/key-planning-documents/2024/annual_financial_statements-2024_final.pdf">Annual Financial Statements 2024 final</a>
    <a href="/files/assets/public/v/2/council/meetings/council-meetings/uhsc_annual-report_2024-2025draft_v6.pdf">UHSC Annual Report 2024-2025</a>
    <a href="https://example.com/annual_financial_statements-2025-final-signed-version.pdf">Upper Hunter financial statements mirror</a>
  `;

  it('discovers the latest FY2024-25 statements and never the annual report, a prior year or a mirror', () => {
    expect(UPPER_HUNTER_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseUpperHunterGpfsReportLinks(pageHtml, UPPER_HUNTER_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      UPPER_HUNTER_PDF_URL,
      'https://www.upperhunter.nsw.gov.au/files/assets/public/v/1/council/documents-and-policies/key-planning-documents/2024/annual_financial_statements-2024_final.pdf',
    ]);
    const selected = selectUpperHunterGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(UPPER_HUNTER_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(UPPER_HUNTER_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Annual Financial Statements 2025 final signed version');
    expect(
      fiscalYearFromUpperHunterGpfsLink('annual_financial_statements-2025-final-signed-version.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromUpperHunterGpfsLink('annual_financial_statements-2024_final.pdf'),
    ).toBe('2023-24');
    expect(
      fiscalYearFromUpperHunterGpfsLink(
        'Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromUpperHunterGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects the older 2023-24 year and never substitutes it for the target 2024-25', () => {
    const olderOnly = `
      <a href="/files/assets/public/v/1/council/documents-and-policies/key-planning-documents/2024/annual_financial_statements-2024_final.pdf">Annual Financial Statements 2024 final</a>
    `;
    const links = parseUpperHunterGpfsReportLinks(olderOnly, UPPER_HUNTER_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectUpperHunterGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('rejects a newer 2025-26 year and never substitutes it for the target 2024-25', () => {
    const newerOnly = `
      <a href="/files/assets/public/v/1/council/documents-and-policies/key-planning-documents/2026/annual_financial_statements-2026-final.pdf">Annual Financial Statements 2026 final</a>
    `;
    const links = parseUpperHunterGpfsReportLinks(newerOnly, UPPER_HUNTER_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectUpperHunterGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseUpperHunterGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      UPPER_HUNTER_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = upperHunterPinnedDocument();
    expect(pinned.url).toBe(UPPER_HUNTER_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('annual_financial_statements-2025-final-signed-version.pdf');
    const discovered = await discoverUpperHunterGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(UPPER_HUNTER_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverUpperHunterGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(UPPER_HUNTER_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(UPPER_HUNTER_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverUpperHunterGpfsDocument(
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
      discoverUpperHunterGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Upper Hunter Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectUpperHunterGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectUpperHunterGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = UPPER_HUNTER_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseUpperHunterGpfsExtraction(
      extraction({ income: withoutUnit }),
      UPPER_HUNTER_CONTEXT,
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
    source: { sha256: UPPER_HUNTER_PDF_SHA256, bytes: 2_884_897 },
    pages: [
      pdfPage(overrides.income ?? UPPER_HUNTER_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? UPPER_HUNTER_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? UPPER_HUNTER_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Upper Hunter Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(128_984);
    expect(reconciliation.total_expenses).toBe(76_036);
    expect(reconciliation.employee_expenses).toBe(18_382);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(22_377);
    expect(reconciliation.government_grants_operating).toBe(15_954);
    expect(reconciliation.government_grants_capital).toBe(72_892);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(4_221);
    expect(reconciliation.net_result).toBe(52_948);
    expect(reconciliation.net_result_before_capital_grants).toBe(-19_944);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(53_659);
    expect(reconciliation.face_expense_bridge).toBe(76_036);
    expect(reconciliation.functions_total_income).toBe(128_984);
    expect(reconciliation.functions_total_expenses).toBe(76_036);
    expect(reconciliation.functions_operating_result).toBe(52_948);
    expect(reconciliation.functions_grants_and_contributions).toBe(88_846);
    expect(reconciliation.comprehensive_income_net_result).toBe(52_948);
    expect(reconciliation.comprehensive_other_income).toBe(185_104);
    expect(reconciliation.comprehensive_total).toBe(238_052);
    expect(reconciliation.comprehensive_revaluation).toBe(185_104);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(128_984);
    expect(reconciliation.expense_components_sum).toBe(53_659);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(12_898_400_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(7_603_600_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_838_200_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_237_700_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_595_400_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(7_289_200_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      422_100_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(101_900_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(2_208_400_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(59_800_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(57_800_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      164_500_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(265_300_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(2_738_400_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(1_523_300_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(5_294_800_000);
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
        source_id: UPPER_HUNTER_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: UPPER_HUNTER_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Upper Hunter Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: UPPER_HUNTER_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Upper Hunter Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^upper-hunter-gpfs:/);
      expect(record.source_url).toContain('annual_financial_statements-2025-final-signed-version.pdf');
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
    const broken = UPPER_HUNTER_FUNCTIONS_TEXT.replace(
      'Total functions and activities 128,984 87,592 76,036 66,739',
      'Total functions and activities 128,984 87,592 76,038 66,739',
    );
    const parsed = parseUpperHunterGpfsExtraction(
      extraction({ functions: broken }),
      UPPER_HUNTER_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = UPPER_HUNTER_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 238,052',
      'Total comprehensive income for the year attributable to Council 238,054',
    );
    const parsed = parseUpperHunterGpfsExtraction(
      extraction({ comprehensive: broken }),
      UPPER_HUNTER_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = UPPER_HUNTER_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 22,084',
      'Rates and annual charges B2-1 22,086',
    );
    const parsed = parseUpperHunterGpfsExtraction(
      extraction({ income: broken }),
      UPPER_HUNTER_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = UPPER_HUNTER_INCOME_TEXT.replace(
      'Net loss from the disposal of assets 4,221',
      'Net loss from the disposal of assets 4,223',
    );
    const parsed = parseUpperHunterGpfsExtraction(
      extraction({ income: broken }),
      UPPER_HUNTER_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = UPPER_HUNTER_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 185,104',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 185,106',
    );
    const parsed = parseUpperHunterGpfsExtraction(
      extraction({ comprehensive: broken }),
      UPPER_HUNTER_CONTEXT,
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
    const url = UPPER_HUNTER_CONTEXT.document.url;
    const revenue = upperHunterGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = upperHunterGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^upper-hunter-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(upperHunterGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(upperHunterGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_upperhuntergpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: UPPER_HUNTER_GPFS_ID,
    name: UPPER_HUNTER_GPFS_NAME,
    publisher: UPPER_HUNTER_GPFS_PUBLISHER,
    source_url: UPPER_HUNTER_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: UPPER_HUNTER_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'upper-hunter-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Upper Hunter Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: UPPER_HUNTER_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-upper-hunter',
        project_name: 'Existing AusTender Upper Hunter contract',
        delivery_entity: 'UPPER HUNTER SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-upper-hunter',
        project_name: 'Existing GrantConnect Upper Hunter grant',
        delivery_entity: 'Upper Hunter Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-upper-hunter-school',
        project_name: 'Existing data.nsw Upper Hunter school row (not a council row)',
        delivery_entity: 'Scone High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-upper-hunter-charity',
        project_name: 'Existing ACNC Upper Hunter charity row (not the council)',
        delivery_entity: 'Upper Hunter Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'narrabri-gpfs',
        source_url: 'https://www.narrabri.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-narrabri-gpfs-1',
        project_name: 'Existing Narrabri GPFS row',
        delivery_entity: 'Narrabri Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'narrabri-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: UPPER_HUNTER_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: UPPER_HUNTER_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: UPPER_HUNTER_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: UPPER_HUNTER_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: UPPER_HUNTER_GPFS_ID,
        delivery_entity: { $ne: 'Upper Hunter Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: UPPER_HUNTER_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
