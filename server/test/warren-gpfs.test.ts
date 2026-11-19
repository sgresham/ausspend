import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WARREN_GPFS_DELIVERY_ENTITY,
  WARREN_GPFS_FISCAL_YEAR,
  WARREN_GPFS_ID,
  WARREN_GPFS_LICENSE,
  WARREN_GPFS_NAME,
  WARREN_GPFS_PUBLISHER,
  WARREN_GPFS_REPORTING_URL,
  detectWarrenGpfsUnit,
  fiscalYearFromWarrenGpfsLink,
  parseWarrenGpfsExtraction,
  parseWarrenGpfsReportLinks,
  selectWarrenGpfsDocument,
  warrenGpfsNaturalKey,
} from '../src/connectors/warren-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  WARREN_COMPREHENSIVE_TEXT,
  WARREN_CONTEXT,
  WARREN_FUNCTIONS_TEXT,
  WARREN_INCOME_TEXT,
  WARREN_PDF_SHA256,
  WARREN_PDF_URL,
  warrenExtraction,
} from '../src/connectors/warren-gpfs/fixture.js';

// Warren Shire Council's official FY2025-26 standalone GPFS. The Income
// Statement prints the Original unaudited budget column before the line label,
// with Actual 2026 and Actual 2025 after it. A parser that took the first number
// in the line would read the budget; the expected values are all Actual 2026.

function parsedFixture() {
  return parseWarrenGpfsExtraction(warrenExtraction(), WARREN_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Warren Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a class="literature" href="/__media_downloads/Financial%20Reports/GPFS-2025.pdf?downloadable=1">
      <i class="far fa-download" aria-hidden="true"></i>
      General Purpose Financial Statements 2024-2025
    </a><a class="literature" href="/__media_downloads/Financial%20Reports/SPFS-2025.pdf?downloadable=1">
      Special Purpose Financial Statements 2024-25
    </a><a class="literature" href="/__media_downloads/Financial%20Reports/SS-2025.pdf?downloadable=1">
      Special Schedules 2024-2025
    </a><a class="literature" href="/__media_downloads/Financial%20Reports/GPFS-2026.pdf?downloadable=1">
      General Purpose Financial Statements 2025-2026
    </a><a class="literature" href="/__media_downloads/Financial%20Reports/SPFS-2026.pdf?downloadable=1">
      Special Purpose Financial Statements 2025-2026
    </a><a class="literature" href="/__media_downloads/Financial%20Reports/SS-2026.pdf?downloadable=1">
      Special Schedules 2025-2026
    </a><a href="/__media_downloads/Annual%20Reports/Annual%20Report%202025-26%20.pdf?downloadable=1">
      Annual Report 2025-2026
    </a>
  `;

  it('discovers the FY2025-26 standalone GPFS from the official page, preserving ?downloadable=1', () => {
    const links = parseWarrenGpfsReportLinks(pageHtml, WARREN_GPFS_REPORTING_URL);
    expect(links).toHaveLength(2);
    const current = links.filter((link) => link.fiscal_year === '2025-26');
    expect(current.map((link) => link.url)).toEqual([WARREN_PDF_URL]);
    const selected = selectWarrenGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(WARREN_PDF_URL);
    expect(selected.url).toContain('?downloadable=1');
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(WARREN_GPFS_REPORTING_URL);
    expect(fiscalYearFromWarrenGpfsLink('General Purpose Financial Statements 2025-2026')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromWarrenGpfsLink('2025/2026')).toBe('2025-26');
    expect(fiscalYearFromWarrenGpfsLink('GPFS-2026.pdf')).toBeNull();
    expect(fiscalYearFromWarrenGpfsLink('General Purpose Financial Statements 2024-2025')).toBe(
      '2024-25',
    );
  });

  it('does not substitute a prior year or the SPFS when the current-year GPFS is absent', () => {
    const priorOnly = `
      <a href="/__media_downloads/Financial%20Reports/GPFS-2025.pdf?downloadable=1">General Purpose Financial Statements 2024-2025</a>
      <a href="/__media_downloads/Financial%20Reports/SPFS-2026.pdf?downloadable=1">Special Purpose Financial Statements 2025-2026</a>
    `;
    const links = parseWarrenGpfsReportLinks(priorOnly, WARREN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectWarrenGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('rejects a financial-statements link on a non-council host', () => {
    const external = `
      <a href="https://example.com/GPFS-2026.pdf?downloadable=1">General Purpose Financial Statements 2025-2026</a>
    `;
    const links = parseWarrenGpfsReportLinks(external, WARREN_GPFS_REPORTING_URL);
    expect(links).toEqual([]);
  });
});

describe('Warren Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectWarrenGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectWarrenGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = WARREN_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseWarrenGpfsExtraction(extraction({ income: withoutUnit }), WARREN_CONTEXT);
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
    source: { sha256: WARREN_PDF_SHA256, bytes: 2_283_613 },
    pages: [
      pdfPage(overrides.income ?? WARREN_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? WARREN_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? WARREN_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Warren Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(37_591);
    expect(reconciliation.total_expenses).toBe(32_275);
    expect(reconciliation.employee_expenses).toBe(7_533);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(7_898);
    expect(reconciliation.government_grants_operating).toBe(19_187);
    expect(reconciliation.government_grants_capital).toBe(4_788);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(6_224);
    expect(reconciliation.net_result).toBe(5_316);
    expect(reconciliation.net_result_before_capital_grants).toBe(528);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(24_377);
    expect(reconciliation.face_expense_bridge).toBe(32_275);
    expect(reconciliation.functions_total_income).toBe(37_591);
    expect(reconciliation.functions_total_expenses).toBe(32_275);
    expect(reconciliation.functions_operating_result).toBe(5_316);
    expect(reconciliation.functions_grants_and_contributions).toBe(23_975);
    expect(reconciliation.comprehensive_income_net_result).toBe(5_316);
    expect(reconciliation.revenue_components_sum).toBe(37_591);
    expect(reconciliation.expense_components_sum).toBe(24_377);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(3_759_100_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_227_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(753_300_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      789_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_918_700_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(478_800_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      622_400_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(745_600_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(138_400_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(531_600_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: WARREN_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: WARREN_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Warren Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: WARREN_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Warren Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^warren-gpfs:/);
      expect(record.source_url).toContain('?downloadable=1');
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
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = WARREN_FUNCTIONS_TEXT.replace(
      '37,591   35,292   32,275   27,524',
      '37,591   35,292   32,273   27,524',
    );
    const parsed = parseWarrenGpfsExtraction(extraction({ functions: broken }), WARREN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = WARREN_COMPREHENSIVE_TEXT.replace(
      'from Income Statement   5,316',
      'from Income Statement   5,314',
    );
    const parsed = parseWarrenGpfsExtraction(extraction({ comprehensive: broken }), WARREN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = WARREN_INCOME_TEXT.replace(
      'Rates and annual charges   B2-1   7,456',
      'Rates and annual charges   B2-1   7,455',
    );
    const parsed = parseWarrenGpfsExtraction(extraction({ income: broken }), WARREN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('is deterministic: repeated parses produce the same natural keys and amounts', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
  });

  it('derives stable, line-specific, fiscal-year-specific natural keys', () => {
    const url = WARREN_CONTEXT.document.url;
    const revenue = warrenGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = warrenGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^warren-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(warrenGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(warrenGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_warrengpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: WARREN_GPFS_ID,
    name: WARREN_GPFS_NAME,
    publisher: WARREN_GPFS_PUBLISHER,
    source_url: WARREN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WARREN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'warren-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Warren Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: WARREN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-warren',
        project_name: 'Existing AusTender Warren Shire contract',
        delivery_entity: 'WARREN SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-warren',
        project_name: 'Existing GrantConnect Warren Shire grant',
        delivery_entity: 'Warren Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-warren-school',
        project_name: 'Existing data.nsw Warren school row (not a council row)',
        delivery_entity: 'Warren Central School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-warren-charity',
        project_name: 'Existing ACNC Warren charity row (not the council)',
        delivery_entity: 'Warren Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: WARREN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: WARREN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: WARREN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WARREN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WARREN_GPFS_ID,
        delivery_entity: { $ne: 'Warren Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: WARREN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
