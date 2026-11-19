import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  NARRABRI_GPFS_DELIVERY_ENTITY,
  NARRABRI_GPFS_DOCUMENT_PIN,
  NARRABRI_GPFS_FISCAL_YEAR,
  NARRABRI_GPFS_ID,
  NARRABRI_GPFS_LICENSE,
  NARRABRI_GPFS_NAME,
  NARRABRI_GPFS_PUBLISHER,
  NARRABRI_GPFS_REPORTING_URL,
  NARRABRI_GPFS_REQUEST_HEADERS,
  narrabriPinnedDocument,
  detectNarrabriGpfsUnit,
  discoverNarrabriGpfsDocument,
  fiscalYearFromNarrabriGpfsLink,
  parseNarrabriGpfsExtraction,
  parseNarrabriGpfsReportLinks,
  selectNarrabriGpfsDocument,
  narrabriGpfsNaturalKey,
} from '../src/connectors/narrabri-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  NARRABRI_COMPREHENSIVE_TEXT,
  NARRABRI_CONTEXT,
  NARRABRI_FUNCTIONS_TEXT,
  NARRABRI_INCOME_TEXT,
  NARRABRI_PDF_SHA256,
  NARRABRI_PDF_URL,
  narrabriExtraction,
} from '../src/connectors/narrabri-gpfs/fixture.js';

// Narrabri Shire Council's audited FY2025-26 standalone General Purpose
// Financial Statements. FY2025-26 is the current audited year (the item title
// originally said FY2024-25, but the official page publishes both and the
// FY2025-26 PDF downloads, so it is preferred). The connector targets 2025-26
// only and never substitutes the prior 2024-25 or 2023-24 document. The Income
// Statement prints the Original unaudited budget column before the line label,
// with Actual 2026 and Actual 2025 after it. A parser that took the first number
// in the line would read the budget; the expected values are all Actual 2026.
// Narrabri prints seven revenue components (there is no net gain on disposal
// line) and five expense components including a real net loss on disposal of
// 8,277. The net result and the before-capital result are both negative. Other
// comprehensive income has a single non-nil component (revaluation 23,327); the
// intangible-asset revaluation line is nil. The B1-1 total row is "Total
// Services" rather than "Total functions and activities".

function parsedFixture() {
  return parseNarrabriGpfsExtraction(narrabriExtraction(), NARRABRI_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Narrabri Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annual-financial-statements/2025-26-annual-financial-statements-iar-inc.pdf">Narrabri Shire Council 2025-26 Annual Financial Statements</a>
    <a href="/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annual-financial-statements/2024-2025-annual-financial-statements.pdf">Narrabri Shire Council 2024-2025 Annual Financial Statements</a>
    <a href="/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annual-financial-statements/2022-2023-annual-financial-statements.pdf">Narrabri Shire Council 2022-2023 Annual Financial Statements</a>
    <a href="/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annaul-report/2024-2025-annual-report.pdf">Narrabri Shire Council 2024-2025 Annual Report</a>
    <a href="https://example.com/2025-26-annual-financial-statements-iar-inc.pdf">Narrabri financial statements mirror</a>
  `;

  it('discovers the FY2025-26 standalone statements and never the annual report, prior year or a mirror', () => {
    expect(NARRABRI_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseNarrabriGpfsReportLinks(pageHtml, NARRABRI_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2022-23']);
    expect(links.map((link) => link.url)).toEqual([
      NARRABRI_PDF_URL,
      'https://www.narrabri.nsw.gov.au/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annual-financial-statements/2024-2025-annual-financial-statements.pdf',
      'https://www.narrabri.nsw.gov.au/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annual-financial-statements/2022-2023-annual-financial-statements.pdf',
    ]);
    const selected = selectNarrabriGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(NARRABRI_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(NARRABRI_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Narrabri Shire Council 2025-26 Annual Financial Statements');
    expect(
      fiscalYearFromNarrabriGpfsLink('2025-26-annual-financial-statements-iar-inc.pdf'),
    ).toBe('2025-26');
    expect(
      fiscalYearFromNarrabriGpfsLink('2024-2025-annual-financial-statements.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromNarrabriGpfsLink(
        'Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromNarrabriGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annual-financial-statements/2024-2025-annual-financial-statements.pdf">Narrabri Shire Council 2024-2025 Annual Financial Statements</a>
    `;
    const links = parseNarrabriGpfsReportLinks(priorOnly, NARRABRI_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectNarrabriGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annual-financial-statements/2026-27-annual-financial-statements.pdf">Narrabri Shire Council 2026-27 Annual Financial Statements</a>
    `;
    const links = parseNarrabriGpfsReportLinks(futureOnly, NARRABRI_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectNarrabriGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseNarrabriGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      NARRABRI_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = narrabriPinnedDocument();
    expect(pinned.url).toBe(NARRABRI_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('2025-26-annual-financial-statements-iar-inc.pdf');
    const discovered = await discoverNarrabriGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(NARRABRI_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverNarrabriGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(NARRABRI_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(NARRABRI_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverNarrabriGpfsDocument(
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
      discoverNarrabriGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Narrabri Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectNarrabriGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectNarrabriGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = NARRABRI_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseNarrabriGpfsExtraction(
      extraction({ income: withoutUnit }),
      NARRABRI_CONTEXT,
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
    source: { sha256: NARRABRI_PDF_SHA256, bytes: 2_904_515 },
    pages: [
      pdfPage(overrides.income ?? NARRABRI_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? NARRABRI_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? NARRABRI_FUNCTIONS_TEXT, 16),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Narrabri Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(70_863);
    expect(reconciliation.total_expenses).toBe(73_003);
    expect(reconciliation.employee_expenses).toBe(22_424);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(17_657);
    expect(reconciliation.government_grants_operating).toBe(19_080);
    expect(reconciliation.government_grants_capital).toBe(9_681);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(8_277);
    expect(reconciliation.net_result).toBe(-2_140);
    expect(reconciliation.net_result_before_capital_grants).toBe(-11_821);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(55_346);
    expect(reconciliation.face_expense_bridge).toBe(73_003);
    expect(reconciliation.functions_total_income).toBe(70_863);
    expect(reconciliation.functions_total_expenses).toBe(73_003);
    expect(reconciliation.functions_operating_result).toBe(-2_140);
    expect(reconciliation.functions_grants_and_contributions).toBe(28_761);
    expect(reconciliation.comprehensive_income_net_result).toBe(-2_140);
    expect(reconciliation.comprehensive_other_income).toBe(23_327);
    expect(reconciliation.comprehensive_total).toBe(21_187);
    expect(reconciliation.comprehensive_revaluation).toBe(23_327);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(70_863);
    expect(reconciliation.expense_components_sum).toBe(55_346);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(7_086_300_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(7_300_300_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(2_242_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_765_700_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_908_000_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(968_100_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      827_700_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(13_800_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(2_619_000_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(257_000_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(11_100_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      249_200_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(98_300_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(2_352_400_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(1_073_900_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(214_000_000);
    expect(netResult.gpfs_printed_sign).toBe('negative');
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
        source_id: NARRABRI_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: NARRABRI_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Narrabri Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: NARRABRI_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Narrabri Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^narrabri-gpfs:/);
      expect(record.source_url).toContain('2025-26-annual-financial-statements-iar-inc.pdf');
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

  it('rejects the whole extraction when the printed Total Services expense total disagrees', () => {
    const broken = NARRABRI_FUNCTIONS_TEXT.replace(
      'Total Services 70,863 70,859 73,003 81,226',
      'Total Services 70,863 70,859 73,005 81,226',
    );
    const parsed = parseNarrabriGpfsExtraction(
      extraction({ functions: broken }),
      NARRABRI_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = NARRABRI_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 21,187',
      'Total comprehensive income for the year attributable to Council 21,189',
    );
    const parsed = parseNarrabriGpfsExtraction(
      extraction({ comprehensive: broken }),
      NARRABRI_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = NARRABRI_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 26,190',
      'Rates and annual charges B2-1 26,192',
    );
    const parsed = parseNarrabriGpfsExtraction(extraction({ income: broken }), NARRABRI_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = NARRABRI_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 8,277',
      'Net loss from the disposal of assets B4-1 8,279',
    );
    const parsed = parseNarrabriGpfsExtraction(extraction({ income: broken }), NARRABRI_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = NARRABRI_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 23,327',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 23,329',
    );
    const parsed = parseNarrabriGpfsExtraction(
      extraction({ comprehensive: broken }),
      NARRABRI_CONTEXT,
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
    const url = NARRABRI_CONTEXT.document.url;
    const revenue = narrabriGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = narrabriGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^narrabri-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(narrabriGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(narrabriGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_narrabrigpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: NARRABRI_GPFS_ID,
    name: NARRABRI_GPFS_NAME,
    publisher: NARRABRI_GPFS_PUBLISHER,
    source_url: NARRABRI_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: NARRABRI_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'narrabri-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Narrabri Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: NARRABRI_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-narrabri',
        project_name: 'Existing AusTender Narrabri contract',
        delivery_entity: 'NARRABRI SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-narrabri',
        project_name: 'Existing GrantConnect Narrabri grant',
        delivery_entity: 'Narrabri Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-narrabri-school',
        project_name: 'Existing data.nsw Narrabri school row (not a council row)',
        delivery_entity: 'Narrabri High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-narrabri-charity',
        project_name: 'Existing ACNC Narrabri charity row (not the council)',
        delivery_entity: 'Narrabri Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'nambucca-valley-gpfs',
        source_url: 'https://www.nambucca.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-nambucca-valley-gpfs-1',
        project_name: 'Existing Nambucca Valley GPFS row',
        delivery_entity: 'Nambucca Valley Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'nambucca-valley-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: NARRABRI_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: NARRABRI_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: NARRABRI_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NARRABRI_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NARRABRI_GPFS_ID,
        delivery_entity: { $ne: 'Narrabri Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: NARRABRI_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
