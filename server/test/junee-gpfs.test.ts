import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  JUNEE_GPFS_DELIVERY_ENTITY,
  JUNEE_GPFS_DOCUMENT_PIN,
  JUNEE_GPFS_ID,
  JUNEE_GPFS_LICENSE,
  JUNEE_GPFS_NAME,
  JUNEE_GPFS_PUBLISHER,
  JUNEE_GPFS_REPORTING_URL,
  juneePinnedDocument,
  detectJuneeGpfsUnit,
  discoverJuneeGpfsDocument,
  fiscalYearFromJuneeGpfsLink,
  parseJuneeGpfsExtraction,
  parseJuneeGpfsReportLinks,
  selectJuneeGpfsDocument,
  juneeGpfsNaturalKey,
} from '../src/connectors/junee-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  JUNEE_COMPREHENSIVE_TEXT,
  JUNEE_CONTEXT,
  JUNEE_FUNCTIONS_TEXT,
  JUNEE_INCOME_TEXT,
  JUNEE_PDF_SHA256,
  JUNEE_PDF_URL,
  juneeExtraction,
} from '../src/connectors/junee-gpfs/fixture.js';

// Junee Shire Council's official FY2025-26 standalone GPFS. The Income
// Statement prints the Original unaudited budget column before the line label,
// with Actual 2026 and Actual 2025 after it. A parser that took the first number
// in the line would read the budget; the expected values are all Actual 2026.
// Junee prints eight revenue lines (including other income and a net gain on
// disposal) and four non-zero expense lines; its net loss on disposal is nil.

function parsedFixture() {
  return parseJuneeGpfsExtraction(juneeExtraction(), JUNEE_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Junee Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="https://www.junee.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026-1.pdf">
      Annual Financial Statements 2026
    </a>
    <a href="https://www.junee.nsw.gov.au/wp-content/uploads/2025/11/Annual_Financial_Statements-2025.pdf">
      Annual Financial Statements 2025
    </a>
    <a href="https://www.junee.nsw.gov.au/wp-content/uploads/2024/10/Annual_Financial_Statements_2024.pdf">
      Annual Financial Statements 2023-2024
    </a>
    <a href="https://www.junee.nsw.gov.au/wp-content/uploads/2026/09/Annual-Report-2025-2026.pdf">
      Annual Report 2025-2026
    </a>
    <a href="https://example.com/Annual_Financial_Statements-2026-1.pdf">
      Annual Financial Statements 2026
    </a>
  `;

  it('discovers the FY2025-26 statements from the official Financial Reports page and ignores the annual report/prior years', () => {
    const links = parseJuneeGpfsReportLinks(pageHtml, JUNEE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year).sort()).toEqual(['2023-24', '2024-25', '2025-26']);
    const current = links.filter((link) => link.fiscal_year === '2025-26');
    expect(current.map((link) => link.url)).toEqual([JUNEE_PDF_URL]);
    const selected = selectJuneeGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(JUNEE_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(JUNEE_GPFS_REPORTING_URL);
    expect(fiscalYearFromJuneeGpfsLink('Annual_Financial_Statements-2026-1.pdf')).toBe('2025-26');
    expect(fiscalYearFromJuneeGpfsLink('Annual_Financial_Statements-2025.pdf')).toBe('2024-25');
    expect(fiscalYearFromJuneeGpfsLink('Annual_Financial_Statements_2024.pdf')).toBe('2023-24');
    expect(fiscalYearFromJuneeGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseJuneeGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      JUNEE_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = juneePinnedDocument();
    expect(pinned.url).toBe(JUNEE_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('junee.nsw.gov.au/wp-content/uploads/2026/10/');
    const discovered = await discoverJuneeGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(JUNEE_GPFS_DOCUMENT_PIN);
  });

  it('does not substitute a prior year for the current-year statements', () => {
    const priorOnly = `
      <a href="https://www.junee.nsw.gov.au/wp-content/uploads/2025/11/Annual_Financial_Statements-2025.pdf">Annual Financial Statements 2025</a>
    `;
    const links = parseJuneeGpfsReportLinks(priorOnly, JUNEE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectJuneeGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('refuses to guess another fiscal year when the listing has none and no pin applies', async () => {
    await expect(
      discoverJuneeGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Junee Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectJuneeGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectJuneeGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = JUNEE_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseJuneeGpfsExtraction(extraction({ income: withoutUnit }), JUNEE_CONTEXT);
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
    source: { sha256: JUNEE_PDF_SHA256, bytes: 972_546 },
    pages: [
      pdfPage(overrides.income ?? JUNEE_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? JUNEE_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? JUNEE_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Junee Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(28_352);
    expect(reconciliation.total_expenses).toBe(22_273);
    expect(reconciliation.employee_expenses).toBe(6_546);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(4_112);
    expect(reconciliation.government_grants_operating).toBe(9_754);
    expect(reconciliation.government_grants_capital).toBe(1_723);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(270);
    expect(reconciliation.net_result).toBe(6_079);
    expect(reconciliation.net_result_before_capital_grants).toBe(4_356);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(18_161);
    expect(reconciliation.face_expense_bridge).toBe(22_273);
    expect(reconciliation.functions_total_income).toBe(28_352);
    expect(reconciliation.functions_total_expenses).toBe(22_273);
    expect(reconciliation.functions_operating_result).toBe(6_079);
    expect(reconciliation.functions_grants_and_contributions).toBe(11_477);
    expect(reconciliation.comprehensive_income_net_result).toBe(6_079);
    expect(reconciliation.comprehensive_other_income).toBe(10_748);
    expect(reconciliation.comprehensive_total).toBe(16_827);
    expect(reconciliation.revenue_components_sum).toBe(28_352);
    expect(reconciliation.expense_components_sum).toBe(18_161);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(2_835_200_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(2_227_300_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(654_600_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      411_200_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(975_400_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(172_300_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(27_000_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(50_500_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(850_000_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(60_900_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(29_000_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(607_900_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: JUNEE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: JUNEE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Junee Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: JUNEE_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Junee Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^junee-gpfs:/);
      expect(record.source_url).toContain('Annual_Financial_Statements-2026-1.pdf');
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
  });

  it('does not sum components with their printed totals', () => {
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
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = JUNEE_FUNCTIONS_TEXT.replace(
      'Total functions and activities   28,352   25,100   22,273   21,349',
      'Total functions and activities   28,352   25,100   22,275   21,349',
    );
    const parsed = parseJuneeGpfsExtraction(extraction({ functions: broken }), JUNEE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = JUNEE_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council   16,827',
      'Total comprehensive income for the year attributable to Council   16,829',
    );
    const parsed = parseJuneeGpfsExtraction(extraction({ comprehensive: broken }), JUNEE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = JUNEE_INCOME_TEXT.replace(
      'Rates and annual charges   B2-1   8,500',
      'Rates and annual charges   B2-1   8,502',
    );
    const parsed = parseJuneeGpfsExtraction(extraction({ income: broken }), JUNEE_CONTEXT);
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
    const url = JUNEE_CONTEXT.document.url;
    const revenue = juneeGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = juneeGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^junee-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(juneeGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(juneeGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_juneegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: JUNEE_GPFS_ID,
    name: JUNEE_GPFS_NAME,
    publisher: JUNEE_GPFS_PUBLISHER,
    source_url: JUNEE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: JUNEE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'junee-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Junee Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: JUNEE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-junee',
        project_name: 'Existing AusTender Junee Shire contract',
        delivery_entity: 'JUNEE SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-junee',
        project_name: 'Existing GrantConnect Junee Shire grant',
        delivery_entity: 'Junee Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-junee-school',
        project_name: 'Existing data.nsw Junee school row (not a council row)',
        delivery_entity: 'Junee High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-junee-charity',
        project_name: 'Existing ACNC Junee charity row (not the council)',
        delivery_entity: 'Junee Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: JUNEE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: JUNEE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: JUNEE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: JUNEE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: JUNEE_GPFS_ID,
        delivery_entity: { $ne: 'Junee Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: JUNEE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
