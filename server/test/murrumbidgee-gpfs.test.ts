import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  MURRUMBIDGEE_GPFS_DELIVERY_ENTITY,
  MURRUMBIDGEE_GPFS_DOCUMENT_PIN,
  MURRUMBIDGEE_GPFS_FISCAL_YEAR,
  MURRUMBIDGEE_GPFS_ID,
  MURRUMBIDGEE_GPFS_LICENSE,
  MURRUMBIDGEE_GPFS_NAME,
  MURRUMBIDGEE_GPFS_PUBLISHER,
  MURRUMBIDGEE_GPFS_REPORTING_URL,
  MURRUMBIDGEE_GPFS_REQUEST_HEADERS,
  murrumbidgeePinnedDocument,
  detectMurrumbidgeeGpfsUnit,
  discoverMurrumbidgeeGpfsDocument,
  fiscalYearFromMurrumbidgeeGpfsLink,
  parseMurrumbidgeeGpfsExtraction,
  parseMurrumbidgeeGpfsReportLinks,
  selectMurrumbidgeeGpfsDocument,
  murrumbidgeeGpfsNaturalKey,
} from '../src/connectors/murrumbidgee-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  MURRUMBIDGEE_COMPREHENSIVE_TEXT,
  MURRUMBIDGEE_CONTEXT,
  MURRUMBIDGEE_FUNCTIONS_TEXT,
  MURRUMBIDGEE_INCOME_TEXT,
  MURRUMBIDGEE_PDF_RESOLVED_URL,
  MURRUMBIDGEE_PDF_SHA256,
  MURRUMBIDGEE_PDF_URL,
  murrumbidgeeExtraction,
} from '../src/connectors/murrumbidgee-gpfs/fixture.js';

// Murrumbidgee Council's audited FY2024-25 Appendix A financial information.
// FY2024-25 is the latest audited year published by the council at 2026-11-19;
// no FY2025-26 GPFS is posted, so FY2024-25 is the accepted current-available
// year and the connector never substitutes a 2025-26 or 2023-24 document. The
// statement source is Appendix A (not the narrative annual report). The Income
// Statement prints the Original unaudited budget column before the line label,
// with Actual 2025 and Actual 2024 after it. A parser that took the first number
// in the line would read the budget; the expected values are all Actual 2025.
// Murrumbidgee prints eight non-zero revenue lines (including a net gain on
// disposal and other income) and four non-zero expense lines; its printed net
// loss on disposal is nil for 2025 and is not emitted. The net result is positive
// and the before-capital result is negative.

function parsedFixture() {
  return parseMurrumbidgeeGpfsExtraction(murrumbidgeeExtraction(), MURRUMBIDGEE_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Murrumbidgee Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/publications/ip-and-r/a-report-2024-25/appendix-a-financial-information.pdf" title="Appendix A Financial Information" class="document ext-pdf">Appendix A Financial Information</a>
    <a href="/files/assets/public/v/3/publications/ip-and-r/a-report-2024-25/mc-annual-report-2024-2025.pdf" title="Annual Report 2024-2025" class="document ext-pdf">Annual Report 2024-2025</a>
    <a href="/files/assets/public/v/1/publications/ip-and-r/a-report-2024-25/appendix-b-governance-report.pdf" title="Appendix B Governance Report" class="document ext-pdf">Appendix B Governance Report</a>
    <a href="https://example.com/appendix-a-financial-information.pdf">Appendix A Financial Information</a>
  `;

  it('discovers the FY2024-25 Appendix A and never the annual report, Appendix B or mirror', () => {
    expect(MURRUMBIDGEE_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseMurrumbidgeeGpfsReportLinks(pageHtml, MURRUMBIDGEE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(links.map((link) => link.url)).toEqual([MURRUMBIDGEE_PDF_URL]);
    const selected = selectMurrumbidgeeGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(MURRUMBIDGEE_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(MURRUMBIDGEE_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromMurrumbidgeeGpfsLink(
        'https://www.murrumbidgee.nsw.gov.au/files/assets/public/v/1/publications/ip-and-r/a-report-2024-25/appendix-a-financial-information.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromMurrumbidgeeGpfsLink(
        'https://www.murrumbidgee.nsw.gov.au/files/assets/public/v/1/publications/ip-and-r/a-report-2023-24/appendix-a-financial-information.pdf',
      ),
    ).toBe('2023-24');
    expect(fiscalYearFromMurrumbidgeeGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/publications/ip-and-r/a-report-2023-24/appendix-a-financial-information.pdf" title="Appendix A Financial Information">Appendix A Financial Information</a>
    `;
    const links = parseMurrumbidgeeGpfsReportLinks(priorOnly, MURRUMBIDGEE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectMurrumbidgeeGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/publications/ip-and-r/a-report-2025-26/appendix-a-financial-information.pdf" title="Appendix A Financial Information">Appendix A Financial Information</a>
    `;
    const links = parseMurrumbidgeeGpfsReportLinks(futureOnly, MURRUMBIDGEE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectMurrumbidgeeGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin (with the resolved v/2 URL) when the listing yields no usable anchor', async () => {
    const links = parseMurrumbidgeeGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      MURRUMBIDGEE_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = murrumbidgeePinnedDocument();
    expect(pinned.url).toBe(MURRUMBIDGEE_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('appendix-a-financial-information.pdf');
    expect(MURRUMBIDGEE_CONTEXT.document.resolved_url).toBe(MURRUMBIDGEE_PDF_RESOLVED_URL);
    expect(MURRUMBIDGEE_PDF_RESOLVED_URL).toContain('/v/2/');
    const discovered = await discoverMurrumbidgeeGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(MURRUMBIDGEE_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA so the Akamai WAF does not return 403', async () => {
    expect(MURRUMBIDGEE_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverMurrumbidgeeGpfsDocument(
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
      discoverMurrumbidgeeGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Murrumbidgee Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectMurrumbidgeeGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectMurrumbidgeeGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = MURRUMBIDGEE_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseMurrumbidgeeGpfsExtraction(
      extraction({ income: withoutUnit }),
      MURRUMBIDGEE_CONTEXT,
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
    source: { sha256: MURRUMBIDGEE_PDF_SHA256, bytes: 1_063_092 },
    pages: [
      pdfPage(overrides.income ?? MURRUMBIDGEE_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? MURRUMBIDGEE_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? MURRUMBIDGEE_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Murrumbidgee Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(30_190);
    expect(reconciliation.total_expenses).toBe(27_076);
    expect(reconciliation.employee_expenses).toBe(10_401);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(8_550);
    expect(reconciliation.government_grants_operating).toBe(9_519);
    expect(reconciliation.government_grants_capital).toBe(8_183);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(360);
    expect(reconciliation.net_result).toBe(3_114);
    expect(reconciliation.net_result_before_capital_grants).toBe(-5_069);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(18_526);
    expect(reconciliation.face_expense_bridge).toBe(27_076);
    expect(reconciliation.functions_total_income).toBe(30_190);
    expect(reconciliation.functions_total_expenses).toBe(27_076);
    expect(reconciliation.functions_operating_result).toBe(3_114);
    expect(reconciliation.functions_grants_and_contributions).toBe(17_702);
    expect(reconciliation.comprehensive_income_net_result).toBe(3_114);
    expect(reconciliation.comprehensive_other_income).toBe(15_836);
    expect(reconciliation.comprehensive_total).toBe(18_950);
    expect(reconciliation.comprehensive_revaluation).toBe(15_836);
    expect(reconciliation.comprehensive_items_not_reclassified).toBe(15_836);
    expect(reconciliation.revenue_components_sum).toBe(30_190);
    expect(reconciliation.expense_components_sum).toBe(18_526);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(3_019_000_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(2_707_600_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_040_100_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      855_000_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(951_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(818_300_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(36_000_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(800_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(689_300_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(45_500_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(18_800_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(311_400_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_loss_from_disposal_of_assets'),
    ).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: MURRUMBIDGEE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: MURRUMBIDGEE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Murrumbidgee Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: MURRUMBIDGEE_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Murrumbidgee Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^murrumbidgee-gpfs:/);
      expect(record.source_url).toContain('appendix-a-financial-information.pdf');
      expect(record.notes).toContain('document_resolved_url: ');
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
    expect(
      records.every((record) =>
        ['revenue', 'expenses', 'result'].includes(String(record.gpfs_section)),
      ),
    ).toBe(true);
    expect(records.every((record) => record.jurisdiction_level === 'local')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = MURRUMBIDGEE_FUNCTIONS_TEXT.replace(
      'Total functions and activities 30,190 33,258 27,076 25,575',
      'Total functions and activities 30,190 33,258 27,078 25,575',
    );
    const parsed = parseMurrumbidgeeGpfsExtraction(
      extraction({ functions: broken }),
      MURRUMBIDGEE_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = MURRUMBIDGEE_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 18,950',
      'Total comprehensive income for the year attributable to Council 18,952',
    );
    const parsed = parseMurrumbidgeeGpfsExtraction(
      extraction({ comprehensive: broken }),
      MURRUMBIDGEE_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = MURRUMBIDGEE_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 6,893',
      'Rates and annual charges B2-1 6,895',
    );
    const parsed = parseMurrumbidgeeGpfsExtraction(extraction({ income: broken }), MURRUMBIDGEE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = MURRUMBIDGEE_COMPREHENSIVE_TEXT.replace(
      'Gain on revaluation of IPP&E C1-7 15,836',
      'Gain on revaluation of IPP&E C1-7 15,838',
    );
    const parsed = parseMurrumbidgeeGpfsExtraction(
      extraction({ comprehensive: broken }),
      MURRUMBIDGEE_CONTEXT,
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
    const url = MURRUMBIDGEE_CONTEXT.document.url;
    const revenue = murrumbidgeeGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = murrumbidgeeGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^murrumbidgee-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(murrumbidgeeGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(murrumbidgeeGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_murrumbidgeegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: MURRUMBIDGEE_GPFS_ID,
    name: MURRUMBIDGEE_GPFS_NAME,
    publisher: MURRUMBIDGEE_GPFS_PUBLISHER,
    source_url: MURRUMBIDGEE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: MURRUMBIDGEE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'murrumbidgee-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Murrumbidgee Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: MURRUMBIDGEE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-murrumbidgee',
        project_name: 'Existing AusTender Murrumbidgee contract',
        delivery_entity: 'MURRUMBIDGEE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-murrumbidgee',
        project_name: 'Existing GrantConnect Murrumbidgee grant',
        delivery_entity: 'Murrumbidgee Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-murrumbidgee-school',
        project_name: 'Existing data.nsw Murrumbidgee school row (not a council row)',
        delivery_entity: 'Murrumbidgee Regional High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-murrumbidgee-charity',
        project_name: 'Existing ACNC Murrumbidgee charity row (not the council)',
        delivery_entity: 'Murrumbidgee Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: MURRUMBIDGEE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: MURRUMBIDGEE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: MURRUMBIDGEE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MURRUMBIDGEE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MURRUMBIDGEE_GPFS_ID,
        delivery_entity: { $ne: 'Murrumbidgee Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: MURRUMBIDGEE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
