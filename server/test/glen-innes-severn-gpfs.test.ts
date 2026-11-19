import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  GLEN_INNES_SEVERN_GPFS_DELIVERY_ENTITY,
  GLEN_INNES_SEVERN_GPFS_DOCUMENT_PIN,
  GLEN_INNES_SEVERN_GPFS_FISCAL_YEAR,
  GLEN_INNES_SEVERN_GPFS_ID,
  GLEN_INNES_SEVERN_GPFS_LICENSE,
  GLEN_INNES_SEVERN_GPFS_NAME,
  GLEN_INNES_SEVERN_GPFS_PUBLISHER,
  GLEN_INNES_SEVERN_GPFS_REPORTING_URL,
  GLEN_INNES_SEVERN_GPFS_REQUEST_HEADERS,
  glenInnesSevernPinnedDocument,
  detectGlenInnesSevernGpfsUnit,
  discoverGlenInnesSevernGpfsDocument,
  fiscalYearFromGlenInnesSevernGpfsLink,
  parseGlenInnesSevernGpfsExtraction,
  parseGlenInnesSevernGpfsReportLinks,
  selectGlenInnesSevernGpfsDocument,
  glenInnesSevernGpfsNaturalKey,
} from '../src/connectors/glen-innes-severn-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  GLEN_INNES_SEVERN_COMPREHENSIVE_TEXT,
  GLEN_INNES_SEVERN_CONTEXT,
  GLEN_INNES_SEVERN_FUNCTIONS_TEXT,
  GLEN_INNES_SEVERN_INCOME_TEXT,
  GLEN_INNES_SEVERN_PDF_SHA256,
  GLEN_INNES_SEVERN_PDF_URL,
  glenInnesSevernExtraction,
} from '../src/connectors/glen-innes-severn-gpfs/fixture.js';

// Glen Innes Severn Council's audited FY2024-25 standalone General Purpose
// Financial Statements. FY2024-25 is the latest obtainable audited year: no
// FY2025-26 audited standalone statements are published as at 2026-11-19 (the
// Annual Reports page lists only the 2024-25 annual report, not a 2024-25
// standalone FS). The connector targets 2024-25 only and never substitutes the
// later 2025-26 or the earlier 2023-24 document. The Income Statement prints the
// Original unaudited budget column before the line label, with Actual 2025 and
// Actual 2024 after it. A parser that took the first number in the line would
// read the budget; the expected values are all Actual 2025. Glen Innes Severn
// prints seven revenue components (there is no net gain on disposal line) and
// five expense components including a real net loss on disposal of 589. The net
// result is positive while the before-capital result is negative. Other
// comprehensive income has a single component (revaluation 27,574).

function parsedFixture() {
  return parseGlenInnesSevernGpfsExtraction(
    glenInnesSevernExtraction(),
    GLEN_INNES_SEVERN_CONTEXT,
  );
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Glen Innes Severn Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-2023-2024.pdf">Audited Financial Statements 2023-2024</a>
    <a href="/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-20222023_1.pdf">Audited Financial Statements 2022-2023</a>
    <a href="/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-2021-2022.pdf">Audited Financial Statements 2021-2022</a>
    <a href="/files/assets/public/v/1/council/documents/public-documents-and-polices/annual-report-2024-2025.pdf">Annual Report 2024-2025</a>
    <a href="https://example.com/audited-financial-statements-2024-25.pdf">Glen Innes Severn financial statements mirror</a>
  `;

  it('discovers the older standalone FS links but not the annual report, and uses the documented FY2024-25 pin', () => {
    expect(GLEN_INNES_SEVERN_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseGlenInnesSevernGpfsReportLinks(pageHtml, GLEN_INNES_SEVERN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24', '2022-23', '2021-22']);
    expect(links.map((link) => link.url)).toEqual([
      'https://www.gisc.nsw.gov.au/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-2023-2024.pdf',
      'https://www.gisc.nsw.gov.au/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-20222023_1.pdf',
      'https://www.gisc.nsw.gov.au/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-2021-2022.pdf',
    ]);
    expect(() => selectGlenInnesSevernGpfsDocument(links, '2024-25')).toThrow(/No published/);
    const pinned = glenInnesSevernPinnedDocument();
    expect(pinned.url).toBe(GLEN_INNES_SEVERN_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(
      fiscalYearFromGlenInnesSevernGpfsLink('audited-financial-statements-2024-25.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromGlenInnesSevernGpfsLink('audited-financial-statements-2023-2024.pdf'),
    ).toBe('2023-24');
    expect(
      fiscalYearFromGlenInnesSevernGpfsLink(
        'Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromGlenInnesSevernGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('selects a 2024-25 standalone anchor when the page carries one', () => {
    const withCurrent = `
      <a href="/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-2024-25.pdf">Audited Financial Statements 2024-25</a>
    `;
    const links = parseGlenInnesSevernGpfsReportLinks(withCurrent, GLEN_INNES_SEVERN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(selectGlenInnesSevernGpfsDocument(links, '2024-25').url).toBe(
      GLEN_INNES_SEVERN_PDF_URL,
    );
  });

  it('rejects the older 2023-24 year and never substitutes it for the target 2024-25', () => {
    const olderOnly = `
      <a href="/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-2023-2024.pdf">Audited Financial Statements 2023-2024</a>
    `;
    const links = parseGlenInnesSevernGpfsReportLinks(olderOnly, GLEN_INNES_SEVERN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectGlenInnesSevernGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('rejects a newer 2025-26 year and never substitutes it for the target 2024-25', () => {
    const newerOnly = `
      <a href="/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-2025-26.pdf">Audited Financial Statements 2025-26</a>
    `;
    const links = parseGlenInnesSevernGpfsReportLinks(newerOnly, GLEN_INNES_SEVERN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectGlenInnesSevernGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('falls back to the documented official pin when the listing lacks the current standalone FS', async () => {
    const discovered = await discoverGlenInnesSevernGpfsDocument(
      (async () => new Response(pageHtml, { status: 200 })) as typeof fetch,
      '2024-25',
      pageHtml,
    );
    expect(discovered.url).toBe(GLEN_INNES_SEVERN_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverGlenInnesSevernGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(GLEN_INNES_SEVERN_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(GLEN_INNES_SEVERN_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverGlenInnesSevernGpfsDocument(
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
      discoverGlenInnesSevernGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Glen Innes Severn Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectGlenInnesSevernGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectGlenInnesSevernGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = GLEN_INNES_SEVERN_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseGlenInnesSevernGpfsExtraction(
      extraction({ income: withoutUnit }),
      GLEN_INNES_SEVERN_CONTEXT,
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
    source: { sha256: GLEN_INNES_SEVERN_PDF_SHA256, bytes: 3_903_779 },
    pages: [
      pdfPage(overrides.income ?? GLEN_INNES_SEVERN_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? GLEN_INNES_SEVERN_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? GLEN_INNES_SEVERN_FUNCTIONS_TEXT, 16),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Glen Innes Severn Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(44_209);
    expect(reconciliation.total_expenses).toBe(34_195);
    expect(reconciliation.employee_expenses).toBe(13_149);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(9_104);
    expect(reconciliation.government_grants_operating).toBe(9_245);
    expect(reconciliation.government_grants_capital).toBe(14_895);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(589);
    expect(reconciliation.net_result).toBe(10_014);
    expect(reconciliation.net_result_before_capital_grants).toBe(-4_881);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(25_091);
    expect(reconciliation.face_expense_bridge).toBe(34_195);
    expect(reconciliation.functions_total_income).toBe(44_209);
    expect(reconciliation.functions_total_expenses).toBe(34_195);
    expect(reconciliation.functions_operating_result).toBe(10_014);
    expect(reconciliation.functions_grants_and_contributions).toBe(24_140);
    expect(reconciliation.comprehensive_income_net_result).toBe(10_014);
    expect(reconciliation.comprehensive_other_income).toBe(27_574);
    expect(reconciliation.comprehensive_total).toBe(37_588);
    expect(reconciliation.comprehensive_revaluation).toBe(27_574);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(44_209);
    expect(reconciliation.expense_components_sum).toBe(25_091);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(4_420_900_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_419_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_314_900_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      910_400_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(924_500_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_489_500_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      58_900_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(52_100_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_386_800_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(89_900_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(30_900_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      122_700_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(124_800_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(958_400_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(376_600_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_001_400_000);
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
        source_id: GLEN_INNES_SEVERN_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: GLEN_INNES_SEVERN_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Glen Innes Severn Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: GLEN_INNES_SEVERN_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Glen Innes Severn Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^glen-innes-severn-gpfs:/);
      expect(record.source_url).toContain('audited-financial-statements-2024-25.pdf');
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
    const broken = GLEN_INNES_SEVERN_FUNCTIONS_TEXT.replace(
      'Total functions and activities 44,209 50,562 34,195 34,240',
      'Total functions and activities 44,209 50,562 34,197 34,240',
    );
    const parsed = parseGlenInnesSevernGpfsExtraction(
      extraction({ functions: broken }),
      GLEN_INNES_SEVERN_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = GLEN_INNES_SEVERN_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 37,588',
      'Total comprehensive income for the year attributable to Council 37,590',
    );
    const parsed = parseGlenInnesSevernGpfsExtraction(
      extraction({ comprehensive: broken }),
      GLEN_INNES_SEVERN_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = GLEN_INNES_SEVERN_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 13,868',
      'Rates and annual charges B2-1 13,870',
    );
    const parsed = parseGlenInnesSevernGpfsExtraction(
      extraction({ income: broken }),
      GLEN_INNES_SEVERN_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = GLEN_INNES_SEVERN_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 589',
      'Net loss from the disposal of assets B4-1 591',
    );
    const parsed = parseGlenInnesSevernGpfsExtraction(
      extraction({ income: broken }),
      GLEN_INNES_SEVERN_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = GLEN_INNES_SEVERN_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 27,574',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 27,576',
    );
    const parsed = parseGlenInnesSevernGpfsExtraction(
      extraction({ comprehensive: broken }),
      GLEN_INNES_SEVERN_CONTEXT,
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
    const url = GLEN_INNES_SEVERN_CONTEXT.document.url;
    const revenue = glenInnesSevernGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = glenInnesSevernGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^glen-innes-severn-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(glenInnesSevernGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(glenInnesSevernGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_gleninnesseverngpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: GLEN_INNES_SEVERN_GPFS_ID,
    name: GLEN_INNES_SEVERN_GPFS_NAME,
    publisher: GLEN_INNES_SEVERN_GPFS_PUBLISHER,
    source_url: GLEN_INNES_SEVERN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: GLEN_INNES_SEVERN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'glen-innes-severn-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Glen Innes Severn Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: GLEN_INNES_SEVERN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-glen-innes-severn',
        project_name: 'Existing AusTender Glen Innes Severn contract',
        delivery_entity: 'GLEN INNES SEVERN COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-glen-innes-severn',
        project_name: 'Existing GrantConnect Glen Innes Severn grant',
        delivery_entity: 'Glen Innes Severn Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-glen-innes-severn-school',
        project_name: 'Existing data.nsw Glen Innes school row (not a council row)',
        delivery_entity: 'Glen Innes High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-glen-innes-severn-charity',
        project_name: 'Existing ACNC Glen Innes charity row (not the council)',
        delivery_entity: 'Glen Innes Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'yass-valley-gpfs',
        source_url: 'https://www.yassvalley.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-yass-valley-gpfs-1',
        project_name: 'Existing Yass Valley GPFS row',
        delivery_entity: 'Yass Valley Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'yass-valley-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: GLEN_INNES_SEVERN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: GLEN_INNES_SEVERN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: GLEN_INNES_SEVERN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GLEN_INNES_SEVERN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GLEN_INNES_SEVERN_GPFS_ID,
        delivery_entity: { $ne: 'Glen Innes Severn Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: GLEN_INNES_SEVERN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
