import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BOURKE_GPFS_DELIVERY_ENTITY,
  BOURKE_GPFS_DOCUMENT_PIN,
  BOURKE_GPFS_FISCAL_YEAR,
  BOURKE_GPFS_ID,
  BOURKE_GPFS_LICENSE,
  BOURKE_GPFS_NAME,
  BOURKE_GPFS_PUBLISHER,
  BOURKE_GPFS_REPORTING_URL,
  bourkePinnedDocument,
  detectBourkeGpfsUnit,
  discoverBourkeGpfsDocument,
  fiscalYearFromBourkeGpfsLink,
  parseBourkeGpfsExtraction,
  parseBourkeGpfsReportLinks,
  selectBourkeGpfsDocument,
  bourkeGpfsNaturalKey,
} from '../src/connectors/bourke-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  BOURKE_COMPREHENSIVE_TEXT,
  BOURKE_CONTEXT,
  BOURKE_FUNCTIONS_TEXT,
  BOURKE_INCOME_TEXT,
  BOURKE_PDF_SHA256,
  BOURKE_PDF_URL,
  bourkeExtraction,
} from '../src/connectors/bourke-gpfs/fixture.js';

// Bourke Shire Council's signed FY2025-26 GPFS. The Income Statement prints the
// Original unaudited budget column before the line label, with Actual 2026 and
// Actual 2025 after it. A parser that took the first number in the line would
// read the budget; the expected values are all Actual 2026. Bourke prints seven
// non-zero revenue lines (net gain on disposal is nil) and five expense lines
// (including borrowing costs and a net loss on disposal). The net result and the
// before-capital result are both positive, so no sign marker is needed.

function parsedFixture() {
  return parseBourkeGpfsExtraction(bourkeExtraction(), BOURKE_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Bourke Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="https://bourke.nsw.gov.au/wp-content/uploads/2026/10/Annual-Financial-Statements-2025-2026.pdf" target="_blank" rel="noopener noreferrer">Download</a>
    <a href="https://bourke.nsw.gov.au/wp-content/uploads/2025/10/Annual-Financial-Statements-2024-2025.pdf" target="_blank" rel="noopener noreferrer">Download</a>
    <a href="https://bourke.nsw.gov.au/wp-content/uploads/2025/11/Annual-Report-2024-2025.pdf" target="_blank" rel="noopener noreferrer">Download</a>
    <a href="https://bourke.nsw.gov.au/wp-content/uploads/2026/07/Budget-Review-Statements-QBRS-Quarter-Ended-31-March-2026.pdf" target="_blank" rel="noopener noreferrer">Download</a>
    <a href="https://bourke.nsw.gov.au/wp-content/uploads/2018/09/Special-Purpose-Financial-Statements-2015.pdf" target="_blank" rel="noopener noreferrer">Download</a>
    <a href="https://example.com/Annual-Financial-Statements-2025-2026.pdf">Annual Financial Statements 2025-2026</a>
  `;

  it('discovers the signed FY2025-26 statements and never the annual report, budget review, special purpose or a prior year', () => {
    expect(BOURKE_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseBourkeGpfsReportLinks(pageHtml, BOURKE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year).sort()).toEqual(['2024-25', '2025-26']);
    const current = links.filter((link) => link.fiscal_year === '2025-26');
    expect(current.map((link) => link.url)).toEqual([BOURKE_PDF_URL]);
    const selected = selectBourkeGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(BOURKE_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(BOURKE_GPFS_REPORTING_URL);
    expect(fiscalYearFromBourkeGpfsLink('Annual-Financial-Statements-2025-2026.pdf')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromBourkeGpfsLink('Annual-Financial-Statements-2024-2025.pdf')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromBourkeGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="https://bourke.nsw.gov.au/wp-content/uploads/2025/10/Annual-Financial-Statements-2024-2025.pdf">Download</a>
    `;
    const links = parseBourkeGpfsReportLinks(priorOnly, BOURKE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectBourkeGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseBourkeGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      BOURKE_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = bourkePinnedDocument();
    expect(pinned.url).toBe(BOURKE_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('Annual-Financial-Statements-2025-2026.pdf');
    const discovered = await discoverBourkeGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(BOURKE_GPFS_DOCUMENT_PIN);
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverBourkeGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Bourke Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectBourkeGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectBourkeGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = BOURKE_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseBourkeGpfsExtraction(extraction({ income: withoutUnit }), BOURKE_CONTEXT);
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
    source: { sha256: BOURKE_PDF_SHA256, bytes: 3_413_641 },
    pages: [
      pdfPage(overrides.income ?? BOURKE_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? BOURKE_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? BOURKE_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Bourke Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(51_143);
    expect(reconciliation.total_expenses).toBe(39_134);
    expect(reconciliation.employee_expenses).toBe(9_206);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(10_895);
    expect(reconciliation.government_grants_operating).toBe(30_590);
    expect(reconciliation.government_grants_capital).toBe(4_172);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(280);
    expect(reconciliation.other_income).toBe(358);
    expect(reconciliation.net_result).toBe(12_009);
    expect(reconciliation.net_result_before_capital_grants).toBe(7_837);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(28_239);
    expect(reconciliation.face_expense_bridge).toBe(39_134);
    expect(reconciliation.functions_total_income).toBe(51_143);
    expect(reconciliation.functions_total_expenses).toBe(39_134);
    expect(reconciliation.functions_operating_result).toBe(12_009);
    expect(reconciliation.functions_grants_and_contributions).toBe(34_762);
    expect(reconciliation.comprehensive_income_net_result).toBe(12_009);
    expect(reconciliation.comprehensive_other_income).toBe(22_603);
    expect(reconciliation.comprehensive_total).toBe(34_612);
    expect(reconciliation.revenue_components_sum).toBe(51_143);
    expect(reconciliation.expense_components_sum).toBe(28_239);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(5_114_300_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_913_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(920_600_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_089_500_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(3_059_000_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(417_200_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(28_000_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(35_800_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(19_600_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(502_400_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(222_000_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_200_900_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: BOURKE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: BOURKE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Bourke Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: BOURKE_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Bourke Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^bourke-gpfs:/);
      expect(record.source_url).toContain('Annual-Financial-Statements-2025-2026.pdf');
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

    // The only rows are printed face-statement line items; there is no derived
    // council-wide aggregate and every row is non-additive agency detail.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(
      records.every((record) =>
        ['revenue', 'expenses', 'result'].includes(String(record.gpfs_section)),
      ),
    ).toBe(true);
    expect(records.every((record) => record.jurisdiction_level === 'local')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = BOURKE_FUNCTIONS_TEXT.replace(
      'Total functions and activities 51,143 36,585 39,134 35,822',
      'Total functions and activities 51,143 36,585 39,136 35,822',
    );
    const parsed = parseBourkeGpfsExtraction(extraction({ functions: broken }), BOURKE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = BOURKE_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 34,612',
      'Total comprehensive income for the year attributable to Council 34,614',
    );
    const parsed = parseBourkeGpfsExtraction(extraction({ comprehensive: broken }), BOURKE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = BOURKE_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 5,024',
      'Rates and annual charges B2-1 5,026',
    );
    const parsed = parseBourkeGpfsExtraction(extraction({ income: broken }), BOURKE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = BOURKE_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 280',
      'Net loss from the disposal of assets B4-1 282',
    );
    const parsed = parseBourkeGpfsExtraction(extraction({ income: broken }), BOURKE_CONTEXT);
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
    const url = BOURKE_CONTEXT.document.url;
    const revenue = bourkeGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = bourkeGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^bourke-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(bourkeGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(bourkeGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_bourkegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BOURKE_GPFS_ID,
    name: BOURKE_GPFS_NAME,
    publisher: BOURKE_GPFS_PUBLISHER,
    source_url: BOURKE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BOURKE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'bourke-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Bourke Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: BOURKE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-bourke',
        project_name: 'Existing AusTender Bourke Shire contract',
        delivery_entity: 'BOURKE SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-bourke',
        project_name: 'Existing GrantConnect Bourke Shire grant',
        delivery_entity: 'Bourke Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-bourke-school',
        project_name: 'Existing data.nsw Bourke school row (not a council row)',
        delivery_entity: 'Bourke High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-bourke-charity',
        project_name: 'Existing ACNC Bourke charity row (not the council)',
        delivery_entity: 'Bourke Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
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
    expect(await MeasureModel.countDocuments({ source_id: BOURKE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BOURKE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: BOURKE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BOURKE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BOURKE_GPFS_ID,
        delivery_entity: { $ne: 'Bourke Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: BOURKE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
