import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  LITHGOW_GPFS_DELIVERY_ENTITY,
  LITHGOW_GPFS_DOCUMENT_PIN,
  LITHGOW_GPFS_FISCAL_YEAR,
  LITHGOW_GPFS_ID,
  LITHGOW_GPFS_LICENSE,
  LITHGOW_GPFS_NAME,
  LITHGOW_GPFS_PUBLISHER,
  LITHGOW_GPFS_REPORTING_URL,
  LITHGOW_GPFS_REQUEST_HEADERS,
  lithgowPinnedDocument,
  detectLithgowGpfsUnit,
  discoverLithgowGpfsDocument,
  fiscalYearFromLithgowGpfsLink,
  parseLithgowGpfsExtraction,
  parseLithgowGpfsReportLinks,
  selectLithgowGpfsDocument,
  lithgowGpfsNaturalKey,
} from '../src/connectors/lithgow-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  LITHGOW_COMPREHENSIVE_TEXT,
  LITHGOW_CONTEXT,
  LITHGOW_FUNCTIONS_TEXT,
  LITHGOW_INCOME_TEXT,
  LITHGOW_PDF_SHA256,
  LITHGOW_PDF_URL,
  lithgowExtraction,
} from '../src/connectors/lithgow-gpfs/fixture.js';

// Lithgow City Council's audited FY2024-25 standalone financial statements.
// FY2024-25 is the latest audited year published by the council at 2026-11-19;
// no FY2025-26 GPFS is posted, so FY2024-25 is the accepted current-available
// year and the connector never substitutes a 2025-26 or 2023-24 document. The
// statement source is the standalone audited financial statements (not the
// narrative annual report). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2025 and Actual 2024 after
// it. A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025 (the FY2024-25 reporting year). Lithgow
// prints seven revenue lines and five expense lines (including a real net loss
// on disposal of 6,979). The net result is negative; the before-capital result
// is also negative.

function parsedFixture() {
  return parseLithgowGpfsExtraction(lithgowExtraction(), LITHGOW_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Lithgow City Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/governance/ipr/reports/financial-statements-2024-2025.pdf" title="Financial Statements 2024/2025" class="document ext-pdf">Financial Statements 2024/2025 (PDF, 5MB)</a>
    <a href="/files/assets/public/v/1/governance/ipr/reports/annual-report-2425.pdf" title="Annual Report 2024-2025" class="document ext-pdf">Annual Report 2024-2025 (PDF, 6MB)</a>
    <a href="/files/assets/public/v/1/governance/ipr/reports/financial-statements-2023-2024.pdf" title="Financial Statements 2023/2024" class="document ext-pdf">Financial Statements 2023/2024 (PDF, 6MB)</a>
    <a href="https://example.com/financial-statements-2024-2025.pdf">Financial Statements 2024/2025</a>
  `;

  it('discovers the FY2024-25 financial statements and never the annual report or a mirror', () => {
    expect(LITHGOW_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseLithgowGpfsReportLinks(pageHtml, LITHGOW_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      LITHGOW_PDF_URL,
      'https://www.lithgow.nsw.gov.au/files/assets/public/v/1/governance/ipr/reports/financial-statements-2023-2024.pdf',
    ]);
    const selected = selectLithgowGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(LITHGOW_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(LITHGOW_GPFS_REPORTING_URL);
    expect(fiscalYearFromLithgowGpfsLink('Financial Statements 2024/2025')).toBe('2024-25');
    expect(
      fiscalYearFromLithgowGpfsLink(
        'https://www.lithgow.nsw.gov.au/files/assets/public/v/1/governance/ipr/reports/financial-statements-2024-2025.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromLithgowGpfsLink(
        'https://www.lithgow.nsw.gov.au/files/assets/public/v/1/governance/ipr/reports/financial-statements-2023-2024.pdf',
      ),
    ).toBe('2023-24');
    expect(fiscalYearFromLithgowGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/governance/ipr/reports/financial-statements-2023-2024.pdf" title="Financial Statements 2023/2024">Financial Statements 2023/2024</a>
    `;
    const links = parseLithgowGpfsReportLinks(priorOnly, LITHGOW_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectLithgowGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/governance/ipr/reports/financial-statements-2025-2026.pdf" title="Financial Statements 2025/2026">Financial Statements 2025/2026</a>
    `;
    const links = parseLithgowGpfsReportLinks(futureOnly, LITHGOW_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectLithgowGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no current anchor', async () => {
    const links = parseLithgowGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      LITHGOW_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = lithgowPinnedDocument();
    expect(pinned.url).toBe(LITHGOW_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('financial-statements-2024-2025.pdf');
    const discovered = await discoverLithgowGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(LITHGOW_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA so the Akamai WAF does not return 403', async () => {
    expect(LITHGOW_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverLithgowGpfsDocument(
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
      discoverLithgowGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Lithgow City Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectLithgowGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectLithgowGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = LITHGOW_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseLithgowGpfsExtraction(
      extraction({ income: withoutUnit }),
      LITHGOW_CONTEXT,
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
    source: { sha256: LITHGOW_PDF_SHA256, bytes: 1_063_092 },
    pages: [
      pdfPage(overrides.income ?? LITHGOW_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? LITHGOW_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? LITHGOW_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Lithgow City Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(78_911);
    expect(reconciliation.total_expenses).toBe(86_998);
    expect(reconciliation.employee_expenses).toBe(24_351);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(18_512);
    expect(reconciliation.government_grants_operating).toBe(7_039);
    expect(reconciliation.government_grants_capital).toBe(16_901);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(6_979);
    expect(reconciliation.net_result).toBe(-8_087);
    expect(reconciliation.net_result_before_capital_grants).toBe(-24_988);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(68_486);
    expect(reconciliation.face_expense_bridge).toBe(86_998);
    expect(reconciliation.functions_total_income).toBe(78_911);
    expect(reconciliation.functions_total_expenses).toBe(86_998);
    expect(reconciliation.functions_operating_result).toBe(-8_087);
    expect(reconciliation.functions_grants_and_contributions).toBe(23_940);
    expect(reconciliation.comprehensive_income_net_result).toBe(-8_087);
    expect(reconciliation.comprehensive_other_income).toBe(-28_339);
    expect(reconciliation.comprehensive_total).toBe(-36_426);
    expect(reconciliation.comprehensive_revaluation).toBe(-27_928);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_remediation_provision).toBe(-411);
    expect(reconciliation.revenue_components_sum).toBe(78_911);
    expect(reconciliation.expense_components_sum).toBe(68_486);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(7_891_100_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(8_699_800_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(2_435_100_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_851_200_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(703_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_690_100_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      697_900_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(49_000_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(4_037_000_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(142_300_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(58_000_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(808_700_000);
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
        source_id: LITHGOW_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: LITHGOW_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Lithgow City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: LITHGOW_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Lithgow City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^lithgow-gpfs:/);
      expect(record.source_url).toContain('financial-statements-2024-2025.pdf');
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
    const broken = LITHGOW_FUNCTIONS_TEXT.replace(
      'Total functions and activities 78,911 86,967 86,998 66,915',
      'Total functions and activities 78,911 86,967 87,000 66,915',
    );
    const parsed = parseLithgowGpfsExtraction(
      extraction({ functions: broken }),
      LITHGOW_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = LITHGOW_COMPREHENSIVE_TEXT.replace(
      'Total and comprehensive income for the year attributable to Council (36,426)',
      'Total and comprehensive income for the year attributable to Council (36,428)',
    );
    const parsed = parseLithgowGpfsExtraction(
      extraction({ comprehensive: broken }),
      LITHGOW_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = LITHGOW_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 40,370',
      'Rates and annual charges B2-1 40,372',
    );
    const parsed = parseLithgowGpfsExtraction(extraction({ income: broken }), LITHGOW_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = LITHGOW_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 (27,928)',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 (27,930)',
    );
    const parsed = parseLithgowGpfsExtraction(
      extraction({ comprehensive: broken }),
      LITHGOW_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the remediation-provision OCI component is altered', () => {
    const broken = LITHGOW_COMPREHENSIVE_TEXT.replace(
      'Fair value adjustment of remediation provision (411)',
      'Fair value adjustment of remediation provision (413)',
    );
    const parsed = parseLithgowGpfsExtraction(
      extraction({ comprehensive: broken }),
      LITHGOW_CONTEXT,
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
    const url = LITHGOW_CONTEXT.document.url;
    const revenue = lithgowGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = lithgowGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^lithgow-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(lithgowGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(lithgowGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_lithgowgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: LITHGOW_GPFS_ID,
    name: LITHGOW_GPFS_NAME,
    publisher: LITHGOW_GPFS_PUBLISHER,
    source_url: LITHGOW_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: LITHGOW_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'lithgow-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Lithgow City Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: LITHGOW_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-lithgow',
        project_name: 'Existing AusTender Lithgow contract',
        delivery_entity: 'LITHGOW CITY COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-lithgow',
        project_name: 'Existing GrantConnect Lithgow grant',
        delivery_entity: 'Lithgow City Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-lithgow-school',
        project_name: 'Existing data.nsw Lithgow school row (not a council row)',
        delivery_entity: 'Lithgow High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-lithgow-charity',
        project_name: 'Existing ACNC Lithgow charity row (not the council)',
        delivery_entity: 'Lithgow Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: LITHGOW_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: LITHGOW_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: LITHGOW_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: LITHGOW_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: LITHGOW_GPFS_ID,
        delivery_entity: { $ne: 'Lithgow City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: LITHGOW_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
