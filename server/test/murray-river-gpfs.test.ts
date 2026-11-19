import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  MURRAY_RIVER_GPFS_DELIVERY_ENTITY,
  MURRAY_RIVER_GPFS_DOCUMENT_PIN,
  MURRAY_RIVER_GPFS_FISCAL_YEAR,
  MURRAY_RIVER_GPFS_ID,
  MURRAY_RIVER_GPFS_LICENSE,
  MURRAY_RIVER_GPFS_NAME,
  MURRAY_RIVER_GPFS_PUBLISHER,
  MURRAY_RIVER_GPFS_REPORTING_URL,
  MURRAY_RIVER_GPFS_REQUEST_HEADERS,
  murrayRiverPinnedDocument,
  detectMurrayRiverGpfsUnit,
  discoverMurrayRiverGpfsDocument,
  fiscalYearFromMurrayRiverGpfsLink,
  parseMurrayRiverGpfsExtraction,
  parseMurrayRiverGpfsReportLinks,
  selectMurrayRiverGpfsDocument,
  murrayRiverGpfsNaturalKey,
} from '../src/connectors/murray-river-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  MURRAY_RIVER_COMPREHENSIVE_TEXT,
  MURRAY_RIVER_CONTEXT,
  MURRAY_RIVER_FUNCTIONS_TEXT,
  MURRAY_RIVER_INCOME_TEXT,
  MURRAY_RIVER_PDF_SHA256,
  MURRAY_RIVER_PDF_URL,
  murrayRiverExtraction,
} from '../src/connectors/murray-river-gpfs/fixture.js';

// Murray River Council's audited FY2025-26 General Purpose Financial Statements,
// embedded in the official MRC-25-26 Annual Report with Financial Statements.
// The work-item title named FY2024-25, but the FY2025-26 document downloads and
// contains the audited GPFS section, so the connector retargeted to FY2025-26.
// The Income Statement prints the Original unaudited budget column before the
// line label, with Actual 2026 and Actual 2025 after it. A parser that took the
// first number in the line would read the budget; the expected values are all
// Actual 2026. Murray River prints seven revenue components (including "Other
// income") and five expense components including a real net loss on disposal of
// 10,687. The net result is negative (-3,144) and the before-capital result is
// more negative (-22,367). Other comprehensive income prints revaluation 4,320
// and revaluation of intangible assets 802, summing to the printed 5,122.

function parsedFixture() {
  return parseMurrayRiverGpfsExtraction(murrayRiverExtraction(), MURRAY_RIVER_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Murray River Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/documents/ipampr-docs-and-budgets/2025-2026/mrc-25-26-annual-report-with-financial-statements.pdf">MRC-25-26-Annual-Report-with-financial-statements.pdf (PDF,&nbsp;5MB)</a>
    <a href="/files/assets/public/v/1/documents/ipampr-docs-and-budgets/2024-2025/mrc-24-25-annual-report-with-financial-statements.pdf">MRC-24-25-Annual-Report-with-financial-statements.pdf (PDF,&nbsp;13MB)</a>
    <a href="/files/assets/public/v/1/documents/ipampr-docs-and-budgets/mrc-annual-report-22-23-with-financial-statements.pdf">MRC-Annual-Report-22-23-with-Financial-Statements.pdf (PDF,&nbsp;13MB)</a>
    <a href="https://example.com/mrc-25-26-annual-report-with-financial-statements.pdf">Murray River financial statements mirror</a>
  `;

  it('discovers the FY2025-26 standalone statements and never the annual report, prior year or a mirror', () => {
    expect(MURRAY_RIVER_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseMurrayRiverGpfsReportLinks(pageHtml, MURRAY_RIVER_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.map((link) => link.url)).toEqual([
      MURRAY_RIVER_PDF_URL,
      'https://www.murrayriver.nsw.gov.au/files/assets/public/v/1/documents/ipampr-docs-and-budgets/2024-2025/mrc-24-25-annual-report-with-financial-statements.pdf',
    ]);
    const selected = selectMurrayRiverGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(MURRAY_RIVER_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(MURRAY_RIVER_GPFS_REPORTING_URL);
    expect(selected.title).toContain('MRC-25-26-Annual-Report-with-financial-statements');
    expect(
      fiscalYearFromMurrayRiverGpfsLink(
        'https://www.murrayriver.nsw.gov.au/files/assets/public/v/1/documents/ipampr-docs-and-budgets/2025-2026/mrc-25-26-annual-report-with-financial-statements.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromMurrayRiverGpfsLink(
        'https://www.murrayriver.nsw.gov.au/files/assets/public/v/1/documents/ipampr-docs-and-budgets/2024-2025/mrc-24-25-annual-report-with-financial-statements.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromMurrayRiverGpfsLink(
        'Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromMurrayRiverGpfsLink('Long Term Financial Plan 2023-2033.pdf')).toBeNull();
  });

  it('rejects a prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/documents/ipampr-docs-and-budgets/2024-2025/mrc-24-25-annual-report-with-financial-statements.pdf">MRC-24-25-Annual-Report-with-financial-statements.pdf (PDF,&nbsp;13MB)</a>
    `;
    const links = parseMurrayRiverGpfsReportLinks(priorOnly, MURRAY_RIVER_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectMurrayRiverGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/documents/ipampr-docs-and-budgets/2026-2027/mrc-26-27-annual-report-with-financial-statements.pdf">MRC-26-27-Annual-Report-with-financial-statements.pdf (PDF,&nbsp;5MB)</a>
    `;
    const links = parseMurrayRiverGpfsReportLinks(futureOnly, MURRAY_RIVER_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectMurrayRiverGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseMurrayRiverGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      MURRAY_RIVER_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = murrayRiverPinnedDocument();
    expect(pinned.url).toBe(MURRAY_RIVER_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('mrc-25-26-annual-report-with-financial-statements.pdf');
    const discovered = await discoverMurrayRiverGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(MURRAY_RIVER_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverMurrayRiverGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(MURRAY_RIVER_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(MURRAY_RIVER_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverMurrayRiverGpfsDocument(
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
      discoverMurrayRiverGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Murray River Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectMurrayRiverGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectMurrayRiverGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = MURRAY_RIVER_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseMurrayRiverGpfsExtraction(
      extraction({ income: withoutUnit }),
      MURRAY_RIVER_CONTEXT,
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
    source: { sha256: MURRAY_RIVER_PDF_SHA256, bytes: 5_726_687 },
    pages: [
      pdfPage(overrides.income ?? MURRAY_RIVER_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? MURRAY_RIVER_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? MURRAY_RIVER_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Murray River Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(86_403);
    expect(reconciliation.total_expenses).toBe(89_547);
    expect(reconciliation.employee_expenses).toBe(23_740);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(22_071);
    expect(reconciliation.government_grants_operating).toBe(21_518);
    expect(reconciliation.government_grants_capital).toBe(19_223);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(10_687);
    expect(reconciliation.net_result).toBe(-3_144);
    expect(reconciliation.net_result_before_capital_grants).toBe(-22_367);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(67_476);
    expect(reconciliation.face_expense_bridge).toBe(89_547);
    expect(reconciliation.functions_total_income).toBe(86_403);
    expect(reconciliation.functions_total_expenses).toBe(89_547);
    expect(reconciliation.functions_operating_result).toBe(-3_144);
    expect(reconciliation.functions_grants_and_contributions).toBe(40_741);
    expect(reconciliation.comprehensive_income_net_result).toBe(-3_144);
    expect(reconciliation.comprehensive_other_income).toBe(5_122);
    expect(reconciliation.comprehensive_total).toBe(1_978);
    expect(reconciliation.comprehensive_revaluation).toBe(4_320);
    expect(reconciliation.comprehensive_other_movements).toBe(802);
    expect(reconciliation.revenue_components_sum).toBe(86_403);
    expect(reconciliation.expense_components_sum).toBe(67_476);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(8_640_300_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(8_954_700_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(2_374_000_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_207_100_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_151_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_922_300_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      1_068_700_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(21_400_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(2_723_800_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(121_000_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(67_400_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      296_300_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(945_000_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(2_338_500_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(1_357_700_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(314_400_000);
    expect(netResult.gpfs_printed_sign).toBe('negative');
    expect(
      records.some((record) => record.gpfs_line_item === 'other_income'),
    ).toBe(true);
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
        source_id: MURRAY_RIVER_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: MURRAY_RIVER_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Murray River Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: MURRAY_RIVER_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Murray River Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^murray-river-gpfs:/);
      expect(record.source_url).toContain('mrc-25-26-annual-report-with-financial-statements.pdf');
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
    const broken = MURRAY_RIVER_FUNCTIONS_TEXT.replace(
      'Total functions and activities 86,403 79,721 89,547 82,008',
      'Total functions and activities 86,403 79,721 89,549 82,008',
    );
    const parsed = parseMurrayRiverGpfsExtraction(
      extraction({ functions: broken }),
      MURRAY_RIVER_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = MURRAY_RIVER_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 1,978',
      'Total comprehensive income for the year attributable to Council 1,980',
    );
    const parsed = parseMurrayRiverGpfsExtraction(
      extraction({ comprehensive: broken }),
      MURRAY_RIVER_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = MURRAY_RIVER_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 27,238',
      'Rates and annual charges B2-1 27,240',
    );
    const parsed = parseMurrayRiverGpfsExtraction(extraction({ income: broken }), MURRAY_RIVER_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = MURRAY_RIVER_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 10,687',
      'Net loss from the disposal of assets B4-1 10,689',
    );
    const parsed = parseMurrayRiverGpfsExtraction(extraction({ income: broken }), MURRAY_RIVER_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when an OCI component is altered', () => {
    const broken = MURRAY_RIVER_COMPREHENSIVE_TEXT.replace(
      'Other movements Revaluation Intangible Assets C1-8 802 130',
      'Other movements Revaluation Intangible Assets C1-8 804 130',
    );
    const parsed = parseMurrayRiverGpfsExtraction(
      extraction({ comprehensive: broken }),
      MURRAY_RIVER_CONTEXT,
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
    const url = MURRAY_RIVER_CONTEXT.document.url;
    const revenue = murrayRiverGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = murrayRiverGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^murray-river-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(murrayRiverGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(murrayRiverGpfsNaturalKey(url, 'total_revenue', '2026-27'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_murray-rivergpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: MURRAY_RIVER_GPFS_ID,
    name: MURRAY_RIVER_GPFS_NAME,
    publisher: MURRAY_RIVER_GPFS_PUBLISHER,
    source_url: MURRAY_RIVER_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: MURRAY_RIVER_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'murray-river-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Murray River Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: MURRAY_RIVER_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-murray-river',
        project_name: 'Existing AusTender Murray River contract',
        delivery_entity: 'UPPER LACHLAN SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-murray-river',
        project_name: 'Existing GrantConnect Murray River grant',
        delivery_entity: 'Murray River Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-murray-river-school',
        project_name: 'Existing data.nsw Murray River school row (not a council row)',
        delivery_entity: 'Murray River High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-murray-river-charity',
        project_name: 'Existing ACNC Murray River charity row (not the council)',
        delivery_entity: 'Murray River Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: MURRAY_RIVER_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: MURRAY_RIVER_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: MURRAY_RIVER_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MURRAY_RIVER_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MURRAY_RIVER_GPFS_ID,
        delivery_entity: { $ne: 'Murray River Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: MURRAY_RIVER_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
