import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BEGA_VALLEY_GPFS_DELIVERY_ENTITY,
  BEGA_VALLEY_GPFS_DOCUMENT_PIN,
  BEGA_VALLEY_GPFS_FISCAL_YEAR,
  BEGA_VALLEY_GPFS_ID,
  BEGA_VALLEY_GPFS_LICENSE,
  BEGA_VALLEY_GPFS_NAME,
  BEGA_VALLEY_GPFS_PUBLISHER,
  BEGA_VALLEY_GPFS_REPORTING_URL,
  BEGA_VALLEY_GPFS_REQUEST_HEADERS,
  begaValleyPinnedDocument,
  detectBegaValleyGpfsUnit,
  discoverBegaValleyGpfsDocument,
  fiscalYearFromBegaValleyGpfsLink,
  parseBegaValleyGpfsExtraction,
  parseBegaValleyGpfsReportLinks,
  selectBegaValleyGpfsDocument,
  begaValleyGpfsNaturalKey,
} from '../src/connectors/bega-valley-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  BEGA_VALLEY_COMPREHENSIVE_TEXT,
  BEGA_VALLEY_CONTEXT,
  BEGA_VALLEY_FUNCTIONS_TEXT,
  BEGA_VALLEY_INCOME_TEXT,
  BEGA_VALLEY_PDF_SHA256,
  BEGA_VALLEY_PDF_URL,
  begaValleyExtraction,
} from '../src/connectors/bega-valley-gpfs/fixture.js';

// Bega Valley Shire Council's audited FY2024-25 standalone financial statements.
// FY2024-25 is the accepted current-available year for this source. The official
// page also lists a 2026 AFS (FY2025-26), but this item is scoped to FY2024-25;
// the connector targets 2024-25 only and never substitutes a 2025-26 or 2023-24
// document. The statement source is the standalone annual financial statements
// (not the narrative annual report). The Income Statement prints the Original
// unaudited budget column before the line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025. Bega Valley prints six revenue
// lines (no separate Other income line) and five expense lines (including a real
// net loss on disposal of 9,018). The net result is positive; the before-capital
// result is negative.

function parsedFixture() {
  return parseBegaValleyGpfsExtraction(begaValleyExtraction(), BEGA_VALLEY_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Bega Valley Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/bega-valley-shire-council-annual_financial_statements-2025.pdf" title="2025 Annual Financial Statements for the year ended 30 June 2025" class="document ext-pdf">2025 Annual Financial Statements for the year ended 30 June 2025 (PDF, 3MB)</a>
    <a href="/files/assets/public/v/2/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/annual_financial_statements-2026.pdf" title="2026 Annual Financial Statements for the year ended 30 June 2026" class="document ext-pdf">2026 Annual Financial Statements for the year ended 30 June 2026 (PDF, 3MB)</a>
    <a href="/files/assets/public/v/1/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/2023-2024-bvsc-financial-statements.pdf" title="2024 Annual Financial Statements for the year ended 30 June 2024" class="document ext-pdf">2024 Annual Financial Statements for the year ended 30 June 2024 (PDF, 6MB)</a>
    <a href="https://example.com/bega-valley-shire-council-annual_financial_statements-2025.pdf">2025 Annual Financial Statements for the year ended 30 June 2025</a>
  `;

  it('discovers the FY2024-25 statements and never substitutes the 2025-26 or 2023-24 documents', () => {
    expect(BEGA_VALLEY_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseBegaValleyGpfsReportLinks(pageHtml, BEGA_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2025-26', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      BEGA_VALLEY_PDF_URL,
      'https://www.begavalley.nsw.gov.au/files/assets/public/v/2/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/annual_financial_statements-2026.pdf',
      'https://www.begavalley.nsw.gov.au/files/assets/public/v/1/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/2023-2024-bvsc-financial-statements.pdf',
    ]);
    const selected = selectBegaValleyGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(BEGA_VALLEY_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(BEGA_VALLEY_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromBegaValleyGpfsLink(
        '2025 Annual Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromBegaValleyGpfsLink(
        'https://www.begavalley.nsw.gov.au/files/assets/public/v/1/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/bega-valley-shire-council-annual_financial_statements-2025.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromBegaValleyGpfsLink(
        'https://www.begavalley.nsw.gov.au/files/assets/public/v/2/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/annual_financial_statements-2026.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromBegaValleyGpfsLink(
        '2024 Annual Financial Statements for the year ended 30 June 2024',
      ),
    ).toBe('2023-24');
    expect(fiscalYearFromBegaValleyGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/2023-2024-bvsc-financial-statements.pdf" title="2024 Annual Financial Statements for the year ended 30 June 2024">2024 Annual Financial Statements</a>
    `;
    const links = parseBegaValleyGpfsReportLinks(priorOnly, BEGA_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectBegaValleyGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute the 2025-26 document for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/2/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/annual_financial_statements-2026.pdf" title="2026 Annual Financial Statements for the year ended 30 June 2026">2026 Annual Financial Statements</a>
    `;
    const links = parseBegaValleyGpfsReportLinks(futureOnly, BEGA_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectBegaValleyGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no current anchor', async () => {
    const links = parseBegaValleyGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      BEGA_VALLEY_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = begaValleyPinnedDocument();
    expect(pinned.url).toBe(BEGA_VALLEY_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('annual_financial_statements-2025.pdf');
    const discovered = await discoverBegaValleyGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(BEGA_VALLEY_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA so the Akamai WAF does not return 403', async () => {
    expect(BEGA_VALLEY_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverBegaValleyGpfsDocument(
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
      discoverBegaValleyGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Bega Valley Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectBegaValleyGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectBegaValleyGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = BEGA_VALLEY_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseBegaValleyGpfsExtraction(
      extraction({ income: withoutUnit }),
      BEGA_VALLEY_CONTEXT,
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
    source: { sha256: BEGA_VALLEY_PDF_SHA256, bytes: 1_063_092 },
    pages: [
      pdfPage(overrides.income ?? BEGA_VALLEY_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? BEGA_VALLEY_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? BEGA_VALLEY_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Bega Valley Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(16);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(171_852);
    expect(reconciliation.total_expenses).toBe(145_387);
    expect(reconciliation.employee_expenses).toBe(44_067);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(40_316);
    expect(reconciliation.government_grants_operating).toBe(24_964);
    expect(reconciliation.government_grants_capital).toBe(36_431);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(9_018);
    expect(reconciliation.net_result).toBe(26_465);
    expect(reconciliation.net_result_before_capital_grants).toBe(-9_966);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(105_071);
    expect(reconciliation.face_expense_bridge).toBe(145_387);
    expect(reconciliation.functions_total_income).toBe(171_852);
    expect(reconciliation.functions_total_expenses).toBe(145_387);
    expect(reconciliation.functions_operating_result).toBe(26_465);
    expect(reconciliation.functions_grants_and_contributions).toBe(61_395);
    expect(reconciliation.comprehensive_income_net_result).toBe(26_465);
    expect(reconciliation.comprehensive_other_income).toBe(38_894);
    expect(reconciliation.comprehensive_total).toBe(65_359);
    expect(reconciliation.comprehensive_revaluation).toBe(39_360);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBe(-466);
    expect(reconciliation.revenue_components_sum).toBe(171_852);
    expect(reconciliation.expense_components_sum).toBe(105_071);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(17_185_200_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(14_538_700_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(4_406_700_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      4_031_600_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_496_400_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(3_643_100_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      901_800_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(122_900_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(7_762_000_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(140_000_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(2_646_500_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'other_income'),
    ).toBe(false);
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
        source_id: BEGA_VALLEY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: BEGA_VALLEY_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Bega Valley Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: BEGA_VALLEY_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Bega Valley Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^bega-valley-gpfs:/);
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
    expect(revenueComponents).toHaveLength(6);
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
    const broken = BEGA_VALLEY_FUNCTIONS_TEXT.replace(
      'Total functions and activities 171,852 167,852 145,387 134,916',
      'Total functions and activities 171,852 167,852 145,389 134,916',
    );
    const parsed = parseBegaValleyGpfsExtraction(
      extraction({ functions: broken }),
      BEGA_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = BEGA_VALLEY_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 65,359',
      'Total comprehensive income for the year attributable to Council 65,361',
    );
    const parsed = parseBegaValleyGpfsExtraction(
      extraction({ comprehensive: broken }),
      BEGA_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = BEGA_VALLEY_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 77,620',
      'Rates and annual charges B2-1 77,622',
    );
    const parsed = parseBegaValleyGpfsExtraction(extraction({ income: broken }), BEGA_VALLEY_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = BEGA_VALLEY_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 39,360',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 39,362',
    );
    const parsed = parseBegaValleyGpfsExtraction(
      extraction({ comprehensive: broken }),
      BEGA_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the other-movements OCI component is altered', () => {
    const broken = BEGA_VALLEY_COMPREHENSIVE_TEXT.replace(
      'Other movements C2-5 (466)',
      'Other movements C2-5 (468)',
    );
    const parsed = parseBegaValleyGpfsExtraction(
      extraction({ comprehensive: broken }),
      BEGA_VALLEY_CONTEXT,
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
    const url = BEGA_VALLEY_CONTEXT.document.url;
    const revenue = begaValleyGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = begaValleyGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^bega-valley-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(begaValleyGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(begaValleyGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_bega-valleygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BEGA_VALLEY_GPFS_ID,
    name: BEGA_VALLEY_GPFS_NAME,
    publisher: BEGA_VALLEY_GPFS_PUBLISHER,
    source_url: BEGA_VALLEY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BEGA_VALLEY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'bega-valley-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Bega Valley Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: BEGA_VALLEY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-bega-valley',
        project_name: 'Existing AusTender Bega Valley contract',
        delivery_entity: 'BEGA VALLEY SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-bega-valley',
        project_name: 'Existing GrantConnect Bega Valley grant',
        delivery_entity: 'Bega Valley Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-bega-valley-school',
        project_name: 'Existing data.nsw Bega Valley school row (not a council row)',
        delivery_entity: 'Bega Valley High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-bega-valley-charity',
        project_name: 'Existing ACNC Bega Valley charity row (not the council)',
        delivery_entity: 'Bega Valley Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'the-hills-gpfs',
        source_url: 'https://www.thehills.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-the-hills-gpfs-1',
        project_name: 'Existing The Hills GPFS row',
        delivery_entity: 'The Hills Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'the-hills-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: BEGA_VALLEY_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BEGA_VALLEY_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    expect(
      await MeasureModel.countDocuments({
        source_id: BEGA_VALLEY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BEGA_VALLEY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BEGA_VALLEY_GPFS_ID,
        delivery_entity: { $ne: 'Bega Valley Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: BEGA_VALLEY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(16);
  });
});
