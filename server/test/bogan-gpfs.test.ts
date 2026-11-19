import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BOGAN_GPFS_DELIVERY_ENTITY,
  BOGAN_GPFS_DOCUMENT_PIN,
  BOGAN_GPFS_ID,
  BOGAN_GPFS_LICENSE,
  BOGAN_GPFS_NAME,
  BOGAN_GPFS_PUBLISHER,
  BOGAN_GPFS_REPORTING_URL,
  boganPinnedDocument,
  detectBoganGpfsUnit,
  discoverBoganGpfsDocument,
  fiscalYearFromBoganGpfsLink,
  parseBoganGpfsExtraction,
  parseBoganGpfsReportLinks,
  selectBoganGpfsDocument,
  boganGpfsNaturalKey,
} from '../src/connectors/bogan-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  BOGAN_COMPREHENSIVE_TEXT,
  BOGAN_CONTEXT,
  BOGAN_FUNCTIONS_TEXT,
  BOGAN_INCOME_TEXT,
  BOGAN_PDF_SHA256,
  BOGAN_PDF_URL,
  boganExtraction,
} from '../src/connectors/bogan-gpfs/fixture.js';

// Bogan Shire Council's official FY2025-26 standalone GPFS. The Income
// Statement prints the Original unaudited budget column before the line label,
// with Actual 2026 and Actual 2025 after it. A parser that took the first number
// in the line would read the budget; the expected values are all Actual 2026.
// Bogan prints eight revenue lines (including a net gain on disposal) and four
// expense lines (including borrowing costs).

function parsedFixture() {
  return parseBoganGpfsExtraction(boganExtraction(), BOGAN_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Bogan Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/ArticleDocuments/517/14.10.2026%20Annual_Financial_Statements-2026.pdf.aspx">
      Annual Financial Statements 2025-26
    </a>
    <a href="/ArticleDocuments/516/Annual_Financial_Statements-2024-2025.pdf.aspx">
      Annual Financial Statements 2024-2025
    </a>
    <a href="/ArticleDocuments/515/Bogan_Shire_Council_Annual_Report_2024-2025.pdf.aspx">
      Annual Report 2024-2025
    </a>
    <a href="https://example.com/Annual_Financial_Statements-2025-26.pdf.aspx">
      Annual Financial Statements 2025-26
    </a>
  `;

  it('discovers the FY2025-26 standalone statements from the official page and ignores the annual report/prior year', () => {
    const links = parseBoganGpfsReportLinks(pageHtml, BOGAN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year).sort()).toEqual(['2024-25', '2025-26']);
    const current = links.filter((link) => link.fiscal_year === '2025-26');
    expect(current.map((link) => link.url)).toEqual([
      'https://bogan.nsw.gov.au/ArticleDocuments/517/14.10.2026%20Annual_Financial_Statements-2026.pdf.aspx',
    ]);
    const selected = selectBoganGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(BOGAN_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(BOGAN_GPFS_REPORTING_URL);
    expect(fiscalYearFromBoganGpfsLink('Annual_Financial_Statements-2026.pdf.aspx')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromBoganGpfsLink('2025/2026')).toBe('2025-26');
    expect(fiscalYearFromBoganGpfsLink('year ended 30 June 2026')).toBe('2025-26');
    expect(fiscalYearFromBoganGpfsLink('GPFS-2026.pdf')).toBeNull();
  });

  it('uses the documented official pin when the live listing hides the link, and never a mirror', () => {
    const links = parseBoganGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      BOGAN_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = boganPinnedDocument();
    expect(pinned.url).toBe(BOGAN_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('bogan.nsw.gov.au/ArticleDocuments/517/');
  });

  it('does not substitute a prior year for the current-year statements', () => {
    const priorOnly = `
      <a href="/ArticleDocuments/516/Annual_Financial_Statements-2024-2025.pdf.aspx">Annual Financial Statements 2024-2025</a>
    `;
    const links = parseBoganGpfsReportLinks(priorOnly, BOGAN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectBoganGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('falls back to the pin for FY2025-26 but refuses to guess another year', async () => {
    const fakeFetch = (async () =>
      new Response('<html>no links</html>', { status: 200 })) as typeof fetch;
    const current = await discoverBoganGpfsDocument(fakeFetch, '2025-26', '<html>no links</html>');
    expect(current.url).toBe(BOGAN_GPFS_DOCUMENT_PIN);
    await expect(
      discoverBoganGpfsDocument(fakeFetch, '2026-27', '<html>no links</html>'),
    ).rejects.toThrow(/No published/);
  });
});

describe('Bogan Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectBoganGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectBoganGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = BOGAN_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseBoganGpfsExtraction(extraction({ income: withoutUnit }), BOGAN_CONTEXT);
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
    source: { sha256: BOGAN_PDF_SHA256, bytes: 1_847_355 },
    pages: [
      pdfPage(overrides.income ?? BOGAN_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? BOGAN_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? BOGAN_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Bogan Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(36_387);
    expect(reconciliation.total_expenses).toBe(30_595);
    expect(reconciliation.employee_expenses).toBe(10_020);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(6_659);
    expect(reconciliation.government_grants_operating).toBe(13_436);
    expect(reconciliation.government_grants_capital).toBe(6_701);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(158);
    expect(reconciliation.net_result).toBe(5_792);
    expect(reconciliation.net_result_before_capital_grants).toBe(-909);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(23_936);
    expect(reconciliation.face_expense_bridge).toBe(30_595);
    expect(reconciliation.functions_total_income).toBe(36_387);
    expect(reconciliation.functions_total_expenses).toBe(30_595);
    expect(reconciliation.functions_operating_result).toBe(5_792);
    expect(reconciliation.functions_grants_and_contributions).toBe(20_137);
    expect(reconciliation.comprehensive_income_net_result).toBe(5_792);
    expect(reconciliation.comprehensive_other_income).toBe(15_304);
    expect(reconciliation.comprehensive_total).toBe(21_096);
    expect(reconciliation.revenue_components_sum).toBe(36_387);
    expect(reconciliation.expense_components_sum).toBe(23_936);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(3_638_700_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_059_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_002_000_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      665_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_343_600_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(670_100_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(15_800_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(5_400_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(593_500_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(26_100_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(579_200_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: BOGAN_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: BOGAN_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Bogan Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: BOGAN_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Bogan Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^bogan-gpfs:/);
      expect(record.source_url).toContain('Annual_Financial_Statements-2026.pdf.aspx');
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
    const broken = BOGAN_FUNCTIONS_TEXT.replace(
      'Total functions and activities   36,387   33,067   30,595   30,102',
      'Total functions and activities   36,387   33,067   30,597   30,102',
    );
    const parsed = parseBoganGpfsExtraction(extraction({ functions: broken }), BOGAN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = BOGAN_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council   21,096',
      'Total comprehensive income for the year attributable to Council   21,098',
    );
    const parsed = parseBoganGpfsExtraction(extraction({ comprehensive: broken }), BOGAN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = BOGAN_INCOME_TEXT.replace(
      'Rates and annual charges   B2-1   5,935',
      'Rates and annual charges   B2-1   5,937',
    );
    const parsed = parseBoganGpfsExtraction(extraction({ income: broken }), BOGAN_CONTEXT);
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
    const url = BOGAN_CONTEXT.document.url;
    const revenue = boganGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = boganGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^bogan-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(boganGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(boganGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_bogangpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BOGAN_GPFS_ID,
    name: BOGAN_GPFS_NAME,
    publisher: BOGAN_GPFS_PUBLISHER,
    source_url: BOGAN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BOGAN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'bogan-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Bogan Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: BOGAN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-bogan',
        project_name: 'Existing AusTender Bogan Shire contract',
        delivery_entity: 'BOGAN SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-bogan',
        project_name: 'Existing GrantConnect Bogan Shire grant',
        delivery_entity: 'Bogan Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-bogan-school',
        project_name: 'Existing data.nsw Bogan school row (not a council row)',
        delivery_entity: 'Bogan Central School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-bogan-charity',
        project_name: 'Existing ACNC Bogan charity row (not the council)',
        delivery_entity: 'Bogan Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: BOGAN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BOGAN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: BOGAN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BOGAN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BOGAN_GPFS_ID,
        delivery_entity: { $ne: 'Bogan Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: BOGAN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
