import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  YASS_VALLEY_GPFS_DELIVERY_ENTITY,
  YASS_VALLEY_GPFS_DOCUMENT_PIN,
  YASS_VALLEY_GPFS_FISCAL_YEAR,
  YASS_VALLEY_GPFS_ID,
  YASS_VALLEY_GPFS_LICENSE,
  YASS_VALLEY_GPFS_NAME,
  YASS_VALLEY_GPFS_PUBLISHER,
  YASS_VALLEY_GPFS_REPORTING_URL,
  YASS_VALLEY_GPFS_REQUEST_HEADERS,
  yassValleyPinnedDocument,
  detectYassValleyGpfsUnit,
  discoverYassValleyGpfsDocument,
  fiscalYearFromYassValleyGpfsLink,
  parseYassValleyGpfsExtraction,
  parseYassValleyGpfsReportLinks,
  selectYassValleyGpfsDocument,
  yassValleyGpfsNaturalKey,
} from '../src/connectors/yass-valley-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  YASS_VALLEY_COMPREHENSIVE_TEXT,
  YASS_VALLEY_CONTEXT,
  YASS_VALLEY_FUNCTIONS_TEXT,
  YASS_VALLEY_INCOME_TEXT,
  YASS_VALLEY_PDF_SHA256,
  YASS_VALLEY_PDF_URL,
  yassValleyExtraction,
} from '../src/connectors/yass-valley-gpfs/fixture.js';

// Yass Valley Council's audited FY2024-25 standalone General Purpose Financial
// Statements. FY2024-25 is the latest obtainable audited year: no FY2025-26
// audited standalone statements are published as at 2026-11-19 (the page lists
// 2025-26/2026-27 budgets, operational plans, revenue statements and quarterly
// reviews, not audited statements). The connector targets 2024-25 only and never
// substitutes the later 2025-26 or the earlier 2023-24 document. The Income
// Statement prints the Original unaudited budget column before the line label,
// with Actual 2025 and Actual 2024 after it. A parser that took the first number
// in the line would read the budget; the expected values are all Actual 2025.
// Yass prints seven revenue components (2025 net gain on disposal nil) and five
// expense components including a real net loss on disposal of 1,223. The net
// result and before-capital result are both positive. Other comprehensive income
// has a single component (revaluation 61,817); the council does not print a
// separate "Total other comprehensive income" line, so the printed "Total items
// which will not be reclassified" is used as the OCI total. The B1-1 total row
// is labelled "Total".

function parsedFixture() {
  return parseYassValleyGpfsExtraction(
    yassValleyExtraction(),
    YASS_VALLEY_CONTEXT,
  );
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Yass Valley Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/2/ipr-council-docs/2024-25/yass-valley-council-audited-2025-financial-statements.pdf">Yass Valley Council Audited Financial Statements 2025</a>
    <a href="/files/assets/public/v/1/our-council/policies-plans-and-reports/2022-2023-annual-financial-statements.pdf">2022-2023 Annual Financial Statements</a>
    <a href="/files/assets/public/v/1/our-council/policies-plans-and-reports/annual-report-2024-2025-final-20nov25_1.pdf">Annual Report 2024-2025</a>
    <a href="https://example.com/yass-valley-council-audited-2025-financial-statements.pdf">Yass Valley financial statements mirror</a>
  `;

  it('discovers the latest FY2024-25 statements and never the annual report, a prior year or a mirror', () => {
    expect(YASS_VALLEY_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseYassValleyGpfsReportLinks(pageHtml, YASS_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2022-23']);
    expect(links.map((link) => link.url)).toEqual([
      YASS_VALLEY_PDF_URL,
      'https://www.yassvalley.nsw.gov.au/files/assets/public/v/1/our-council/policies-plans-and-reports/2022-2023-annual-financial-statements.pdf',
    ]);
    const selected = selectYassValleyGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(YASS_VALLEY_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(YASS_VALLEY_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Yass Valley Council Audited Financial Statements 2025');
    expect(
      fiscalYearFromYassValleyGpfsLink('yass-valley-council-audited-2025-financial-statements.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromYassValleyGpfsLink('2022-2023-annual-financial-statements.pdf'),
    ).toBe('2022-23');
    expect(
      fiscalYearFromYassValleyGpfsLink(
        'Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromYassValleyGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects the older 2022-23 year and never substitutes it for the target 2024-25', () => {
    const olderOnly = `
      <a href="/files/assets/public/v/1/our-council/policies-plans-and-reports/2022-2023-annual-financial-statements.pdf">2022-2023 Annual Financial Statements</a>
    `;
    const links = parseYassValleyGpfsReportLinks(olderOnly, YASS_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2022-23']);
    expect(() => selectYassValleyGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('rejects a newer 2025-26 year and never substitutes it for the target 2024-25', () => {
    const newerOnly = `
      <a href="/files/assets/public/v/1/ipr-council-docs/2025-26/annual-financial-statements-2026.pdf">Annual Financial Statements 2026</a>
    `;
    const links = parseYassValleyGpfsReportLinks(newerOnly, YASS_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectYassValleyGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseYassValleyGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      YASS_VALLEY_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = yassValleyPinnedDocument();
    expect(pinned.url).toBe(YASS_VALLEY_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('yass-valley-council-audited-2025-financial-statements.pdf');
    const discovered = await discoverYassValleyGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(YASS_VALLEY_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverYassValleyGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(YASS_VALLEY_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(YASS_VALLEY_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverYassValleyGpfsDocument(
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
      discoverYassValleyGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Yass Valley Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectYassValleyGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectYassValleyGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = YASS_VALLEY_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseYassValleyGpfsExtraction(
      extraction({ income: withoutUnit }),
      YASS_VALLEY_CONTEXT,
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
    source: { sha256: YASS_VALLEY_PDF_SHA256, bytes: 2_310_734 },
    pages: [
      pdfPage(overrides.income ?? YASS_VALLEY_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? YASS_VALLEY_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? YASS_VALLEY_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Yass Valley Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(61_813);
    expect(reconciliation.total_expenses).toBe(39_454);
    expect(reconciliation.employee_expenses).toBe(13_295);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(10_059);
    expect(reconciliation.government_grants_operating).toBe(8_648);
    expect(reconciliation.government_grants_capital).toBe(20_421);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(1_223);
    expect(reconciliation.net_result).toBe(22_359);
    expect(reconciliation.net_result_before_capital_grants).toBe(1_938);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(29_395);
    expect(reconciliation.face_expense_bridge).toBe(39_454);
    expect(reconciliation.functions_total_income).toBe(61_813);
    expect(reconciliation.functions_total_expenses).toBe(39_454);
    expect(reconciliation.functions_operating_result).toBe(22_359);
    expect(reconciliation.functions_grants_and_contributions).toBe(29_069);
    expect(reconciliation.comprehensive_income_net_result).toBe(22_359);
    expect(reconciliation.comprehensive_other_income).toBe(61_817);
    expect(reconciliation.comprehensive_total).toBe(84_176);
    expect(reconciliation.comprehensive_revaluation).toBe(61_817);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(61_813);
    expect(reconciliation.expense_components_sum).toBe(29_395);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(6_181_300_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_945_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_329_500_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_005_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(864_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(2_042_100_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      122_300_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(71_700_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(2_315_600_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(68_000_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(41_800_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      231_000_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(113_700_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(1_302_300_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(618_000_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(2_235_900_000);
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
        source_id: YASS_VALLEY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: YASS_VALLEY_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Yass Valley Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: YASS_VALLEY_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Yass Valley Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^yass-valley-gpfs:/);
      expect(record.source_url).toContain('yass-valley-council-audited-2025-financial-statements.pdf');
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

  it('rejects the whole extraction when the printed B1-1 Total expense row disagrees', () => {
    const broken = YASS_VALLEY_FUNCTIONS_TEXT.replace(
      'Total 61,813 63,129 39,454 44,448',
      'Total 61,813 63,129 39,456 44,448',
    );
    const parsed = parseYassValleyGpfsExtraction(
      extraction({ functions: broken }),
      YASS_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = YASS_VALLEY_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 84,176',
      'Total comprehensive income for the year attributable to Council 84,178',
    );
    const parsed = parseYassValleyGpfsExtraction(
      extraction({ comprehensive: broken }),
      YASS_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = YASS_VALLEY_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 23,156',
      'Rates and annual charges B2-1 23,158',
    );
    const parsed = parseYassValleyGpfsExtraction(
      extraction({ income: broken }),
      YASS_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = YASS_VALLEY_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 1,223',
      'Net loss from the disposal of assets B4-1 1,225',
    );
    const parsed = parseYassValleyGpfsExtraction(
      extraction({ income: broken }),
      YASS_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = YASS_VALLEY_COMPREHENSIVE_TEXT.replace(
      'Gain on revaluation of infrastructure, property, plant and equipment C1-5 61,817',
      'Gain on revaluation of infrastructure, property, plant and equipment C1-5 61,819',
    );
    const parsed = parseYassValleyGpfsExtraction(
      extraction({ comprehensive: broken }),
      YASS_VALLEY_CONTEXT,
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
    const url = YASS_VALLEY_CONTEXT.document.url;
    const revenue = yassValleyGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = yassValleyGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^yass-valley-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(yassValleyGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(yassValleyGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_yassvalleygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: YASS_VALLEY_GPFS_ID,
    name: YASS_VALLEY_GPFS_NAME,
    publisher: YASS_VALLEY_GPFS_PUBLISHER,
    source_url: YASS_VALLEY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: YASS_VALLEY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'yass-valley-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Yass Valley Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: YASS_VALLEY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-yass-valley',
        project_name: 'Existing AusTender Yass Valley contract',
        delivery_entity: 'YASS VALLEY COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-yass-valley',
        project_name: 'Existing GrantConnect Yass Valley grant',
        delivery_entity: 'Yass Valley Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-yass-valley-school',
        project_name: 'Existing data.nsw Yass Valley school row (not a council row)',
        delivery_entity: 'Yass High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-yass-valley-charity',
        project_name: 'Existing ACNC Yass Valley charity row (not the council)',
        delivery_entity: 'Yass Valley Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'upper-hunter-gpfs',
        source_url: 'https://www.upperhunter.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-upper-hunter-gpfs-1',
        project_name: 'Existing Upper Hunter GPFS row',
        delivery_entity: 'Upper Hunter Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'upper-hunter-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: YASS_VALLEY_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: YASS_VALLEY_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: YASS_VALLEY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: YASS_VALLEY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: YASS_VALLEY_GPFS_ID,
        delivery_entity: { $ne: 'Yass Valley Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: YASS_VALLEY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
