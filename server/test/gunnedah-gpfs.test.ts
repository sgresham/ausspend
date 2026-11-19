import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  GUNNEDAH_GPFS_DELIVERY_ENTITY,
  GUNNEDAH_GPFS_DOCUMENT_PIN,
  GUNNEDAH_GPFS_FISCAL_YEAR,
  GUNNEDAH_GPFS_ID,
  GUNNEDAH_GPFS_LICENSE,
  GUNNEDAH_GPFS_NAME,
  GUNNEDAH_GPFS_PUBLISHER,
  GUNNEDAH_GPFS_REPORTING_URL,
  GUNNEDAH_GPFS_REQUEST_HEADERS,
  gunnedahPinnedDocument,
  detectGunnedahGpfsUnit,
  discoverGunnedahGpfsDocument,
  fiscalYearFromGunnedahGpfsLink,
  parseGunnedahGpfsExtraction,
  parseGunnedahGpfsReportLinks,
  selectGunnedahGpfsDocument,
  gunnedahGpfsNaturalKey,
} from '../src/connectors/gunnedah-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  GUNNEDAH_COMPREHENSIVE_TEXT,
  GUNNEDAH_CONTEXT,
  GUNNEDAH_FUNCTIONS_TEXT,
  GUNNEDAH_INCOME_TEXT,
  GUNNEDAH_PDF_SHA256,
  GUNNEDAH_PDF_URL,
  gunnedahExtraction,
} from '../src/connectors/gunnedah-gpfs/fixture.js';

// Gunnedah Shire Council's audited FY2025-26 standalone General Purpose
// Financial Statements. FY2025-26 is the current audited year (the item title
// originally said FY2024-25, but the official page publishes both and FY2025-26
// is preferred). The connector targets 2025-26 only and never substitutes the
// prior 2024-25 or 2023-24 document. The Income Statement prints the Original
// unaudited budget column before the line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Gunnedah prints seven
// revenue components (other revenues and other income are separate; there is no
// net gain on disposal line) and five expense components including a real net
// loss on disposal of 2,712. The net result and the before-capital result are
// both positive. Other comprehensive income has a single component (revaluation
// 27,474).

function parsedFixture() {
  return parseGunnedahGpfsExtraction(gunnedahExtraction(), GUNNEDAH_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Gunnedah Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/2/images/gunnedahshirecouncil/council/the-future-of-gunnedah/financial-reports/gunnedah-shire-council-financial-statements-2025-26.pdf">Gunnedah Shire Council Financial Statements 2025-26</a>
    <a href="/files/assets/public/v/1/images/gunnedahshirecouncil/council/the-future-of-gunnedah/financial-reports/gunnedah-shire-council-financial-statements-2024-25.pdf">Gunnedah Shire Council Financial Statements 2024-25</a>
    <a href="/files/assets/public/v/2/images/gunnedahshirecouncil/council/the-future-of-gunnedah/financial-reports/gunnedah-shire-council-financial-statements-2023-24.pdf">Gunnedah Shire Council Financial Statements 2023-24</a>
    <a href="https://example.com/gunnedah-shire-council-financial-statements-2025-26.pdf">Gunnedah financial statements mirror</a>
  `;

  it('discovers the FY2025-26 standalone statements and never the prior year or a mirror', () => {
    expect(GUNNEDAH_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseGunnedahGpfsReportLinks(pageHtml, GUNNEDAH_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      GUNNEDAH_PDF_URL,
      'https://www.gunnedah.nsw.gov.au/files/assets/public/v/1/images/gunnedahshirecouncil/council/the-future-of-gunnedah/financial-reports/gunnedah-shire-council-financial-statements-2024-25.pdf',
      'https://www.gunnedah.nsw.gov.au/files/assets/public/v/2/images/gunnedahshirecouncil/council/the-future-of-gunnedah/financial-reports/gunnedah-shire-council-financial-statements-2023-24.pdf',
    ]);
    const selected = selectGunnedahGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(GUNNEDAH_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(GUNNEDAH_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Gunnedah Shire Council Financial Statements 2025-26');
    expect(
      fiscalYearFromGunnedahGpfsLink(
        'gunnedah-shire-council-financial-statements-2025-26.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromGunnedahGpfsLink(
        'gunnedah-shire-council-financial-statements-2024-25.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromGunnedahGpfsLink(
        'Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromGunnedahGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/images/gunnedahshirecouncil/council/the-future-of-gunnedah/financial-reports/gunnedah-shire-council-financial-statements-2024-25.pdf">Gunnedah Shire Council Financial Statements 2024-25</a>
    `;
    const links = parseGunnedahGpfsReportLinks(priorOnly, GUNNEDAH_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectGunnedahGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/2/images/gunnedahshirecouncil/council/the-future-of-gunnedah/financial-reports/gunnedah-shire-council-financial-statements-2026-27.pdf">Gunnedah Shire Council Financial Statements 2026-27</a>
    `;
    const links = parseGunnedahGpfsReportLinks(futureOnly, GUNNEDAH_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectGunnedahGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseGunnedahGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      GUNNEDAH_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = gunnedahPinnedDocument();
    expect(pinned.url).toBe(GUNNEDAH_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('gunnedah-shire-council-financial-statements-2025-26.pdf');
    const discovered = await discoverGunnedahGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(GUNNEDAH_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverGunnedahGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(GUNNEDAH_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(GUNNEDAH_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverGunnedahGpfsDocument(
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
      discoverGunnedahGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Gunnedah Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectGunnedahGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectGunnedahGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = GUNNEDAH_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseGunnedahGpfsExtraction(
      extraction({ income: withoutUnit }),
      GUNNEDAH_CONTEXT,
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
    source: { sha256: GUNNEDAH_PDF_SHA256, bytes: 5_734_060 },
    pages: [
      pdfPage(overrides.income ?? GUNNEDAH_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? GUNNEDAH_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? GUNNEDAH_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Gunnedah Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(79_958);
    expect(reconciliation.total_expenses).toBe(61_212);
    expect(reconciliation.employee_expenses).toBe(22_476);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(16_310);
    expect(reconciliation.government_grants_operating).toBe(20_189);
    expect(reconciliation.government_grants_capital).toBe(13_591);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(2_712);
    expect(reconciliation.net_result).toBe(18_746);
    expect(reconciliation.net_result_before_capital_grants).toBe(5_155);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(44_902);
    expect(reconciliation.face_expense_bridge).toBe(61_212);
    expect(reconciliation.functions_total_income).toBe(79_958);
    expect(reconciliation.functions_total_expenses).toBe(61_212);
    expect(reconciliation.functions_operating_result).toBe(18_746);
    expect(reconciliation.functions_grants_and_contributions).toBe(33_780);
    expect(reconciliation.comprehensive_income_net_result).toBe(18_746);
    expect(reconciliation.comprehensive_other_income).toBe(27_474);
    expect(reconciliation.comprehensive_total).toBe(46_220);
    expect(reconciliation.comprehensive_revaluation).toBe(27_474);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(79_958);
    expect(reconciliation.expense_components_sum).toBe(44_902);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(7_995_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(6_121_200_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(2_247_600_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_631_000_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_018_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_359_100_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      271_200_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(98_300_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(2_568_300_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(102_800_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(13_400_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      435_000_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(70_600_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(1_802_500_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(1_498_300_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_874_600_000);
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
        source_id: GUNNEDAH_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: GUNNEDAH_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Gunnedah Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: GUNNEDAH_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Gunnedah Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^gunnedah-gpfs:/);
      expect(record.source_url).toContain('gunnedah-shire-council-financial-statements-2025-26.pdf');
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
    const broken = GUNNEDAH_FUNCTIONS_TEXT.replace(
      'Total functions and activities 79,958 69,981 61,212 62,711',
      'Total functions and activities 79,958 69,981 61,214 62,711',
    );
    const parsed = parseGunnedahGpfsExtraction(
      extraction({ functions: broken }),
      GUNNEDAH_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = GUNNEDAH_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 46,220',
      'Total comprehensive income for the year attributable to Council 46,222',
    );
    const parsed = parseGunnedahGpfsExtraction(
      extraction({ comprehensive: broken }),
      GUNNEDAH_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = GUNNEDAH_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 25,683',
      'Rates and annual charges B2-1 25,685',
    );
    const parsed = parseGunnedahGpfsExtraction(extraction({ income: broken }), GUNNEDAH_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = GUNNEDAH_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 2,712',
      'Net loss from the disposal of assets B4-1 2,714',
    );
    const parsed = parseGunnedahGpfsExtraction(extraction({ income: broken }), GUNNEDAH_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = GUNNEDAH_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 27,474',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 27,476',
    );
    const parsed = parseGunnedahGpfsExtraction(
      extraction({ comprehensive: broken }),
      GUNNEDAH_CONTEXT,
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
    const url = GUNNEDAH_CONTEXT.document.url;
    const revenue = gunnedahGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = gunnedahGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^gunnedah-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(gunnedahGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(gunnedahGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_gunnedahgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: GUNNEDAH_GPFS_ID,
    name: GUNNEDAH_GPFS_NAME,
    publisher: GUNNEDAH_GPFS_PUBLISHER,
    source_url: GUNNEDAH_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: GUNNEDAH_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'gunnedah-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Gunnedah Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: GUNNEDAH_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-gunnedah',
        project_name: 'Existing AusTender Gunnedah contract',
        delivery_entity: 'GUNNEDAH SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-gunnedah',
        project_name: 'Existing GrantConnect Gunnedah grant',
        delivery_entity: 'Gunnedah Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-gunnedah-school',
        project_name: 'Existing data.nsw Gunnedah school row (not a council row)',
        delivery_entity: 'Gunnedah High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-gunnedah-charity',
        project_name: 'Existing ACNC Gunnedah charity row (not the council)',
        delivery_entity: 'Gunnedah Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'bellingen-gpfs',
        source_url: 'https://www.bellingen.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-bellingen-gpfs-1',
        project_name: 'Existing Bellingen GPFS row',
        delivery_entity: 'Bellingen Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'bellingen-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: GUNNEDAH_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: GUNNEDAH_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: GUNNEDAH_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GUNNEDAH_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GUNNEDAH_GPFS_ID,
        delivery_entity: { $ne: 'Gunnedah Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: GUNNEDAH_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
