import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  MOREE_GPFS_DELIVERY_ENTITY,
  MOREE_GPFS_DOCUMENT_PIN,
  MOREE_GPFS_FISCAL_YEAR,
  MOREE_GPFS_ID,
  MOREE_GPFS_LICENSE,
  MOREE_GPFS_NAME,
  MOREE_GPFS_PUBLISHER,
  MOREE_GPFS_REPORTING_URL,
  moreePinnedDocument,
  detectMoreeGpfsUnit,
  discoverMoreeGpfsDocument,
  fiscalYearFromMoreeGpfsLink,
  parseMoreeGpfsExtraction,
  parseMoreeGpfsReportLinks,
  selectMoreeGpfsDocument,
  moreeGpfsNaturalKey,
} from '../src/connectors/moree-plains-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  MOREE_COMPREHENSIVE_TEXT,
  MOREE_CONTEXT,
  MOREE_FUNCTIONS_TEXT,
  MOREE_INCOME_TEXT,
  MOREE_PDF_SHA256,
  MOREE_PDF_URL,
  moreeExtraction,
} from '../src/connectors/moree-plains-gpfs/fixture.js';

// Moree Plains Shire Council's audited FY2024-25 statements. This is the latest
// audited standalone GPFS published by the council at 2026-11-19 (there is no
// FY2025-26 document yet), so FY2024-25 is the accepted current-available year
// and the connector never substitutes a different year. The Income Statement
// prints the Original unaudited budget column before the line label, with Actual
// 2025 and Actual 2024 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2025. Moree Plains
// prints six revenue lines and five expense lines (including borrowing costs and
// a net loss on disposal). The net result is positive and the before-capital
// result is negative.

function parsedFixture() {
  return parseMoreeGpfsExtraction(moreeExtraction(), MOREE_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Moree Plains Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/publications-documents/financial-statements/2911-2024-25-annual-financial-statement/file">
      2024-25 Annual Financial Statement
    </a>
    <a href="/hot-topics/docman/financial-statements/2024-2020-21-financial-statements/file">
      2020-21 Financial Statements
    </a>
    <a href="https://www.mpsc.nsw.gov.au/publications-documents/financial-statements/3000-2025-26-annual-financial-statement/file">
      2025-26 Annual Financial Statement
    </a>
    <a href="https://example.com/2911-2024-25-annual-financial-statement/file">
      2024-25 Annual Financial Statement
    </a>
  `;

  it('accepts FY2024-25 as the brief current-available year and discovers the audited statements', () => {
    expect(MOREE_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseMoreeGpfsReportLinks(pageHtml, MOREE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year).sort()).toEqual(['2020-21', '2024-25', '2025-26']);
    const current = links.filter((link) => link.fiscal_year === '2024-25');
    expect(current.map((link) => link.url)).toEqual([MOREE_PDF_URL]);
    const selected = selectMoreeGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(MOREE_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(MOREE_GPFS_REPORTING_URL);
    expect(fiscalYearFromMoreeGpfsLink('2911-2024-25-annual-financial-statement')).toBe('2024-25');
    expect(fiscalYearFromMoreeGpfsLink('2020-21 Financial Statements')).toBe('2020-21');
    expect(fiscalYearFromMoreeGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale year and never silently substitutes 2020-21 for the target 2024-25', () => {
    const staleOnly = `
      <a href="/hot-topics/docman/financial-statements/2024-2020-21-financial-statements/file">2020-21 Financial Statements</a>
    `;
    const links = parseMoreeGpfsReportLinks(staleOnly, MOREE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2020-21']);
    expect(() => selectMoreeGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="https://www.mpsc.nsw.gov.au/publications-documents/financial-statements/3000-2025-26-annual-financial-statement/file">2025-26 Annual Financial Statement</a>
    `;
    const links = parseMoreeGpfsReportLinks(futureOnly, MOREE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectMoreeGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseMoreeGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      MOREE_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = moreePinnedDocument();
    expect(pinned.url).toBe(MOREE_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('2911-2024-25-annual-financial-statement');
    const discovered = await discoverMoreeGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(MOREE_GPFS_DOCUMENT_PIN);
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverMoreeGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Moree Plains Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectMoreeGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectMoreeGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = MOREE_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseMoreeGpfsExtraction(extraction({ income: withoutUnit }), MOREE_CONTEXT);
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
    source: { sha256: MOREE_PDF_SHA256, bytes: 1_999_180 },
    pages: [
      pdfPage(overrides.income ?? MOREE_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? MOREE_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? MOREE_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Moree Plains Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(16);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(92_138);
    expect(reconciliation.total_expenses).toBe(86_662);
    expect(reconciliation.employee_expenses).toBe(24_862);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(19_793);
    expect(reconciliation.government_grants_operating).toBe(18_179);
    expect(reconciliation.government_grants_capital).toBe(15_248);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(968);
    expect(reconciliation.net_result).toBe(5_476);
    expect(reconciliation.net_result_before_capital_grants).toBe(-9_772);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(66_869);
    expect(reconciliation.face_expense_bridge).toBe(86_662);
    expect(reconciliation.functions_total_income).toBe(92_138);
    expect(reconciliation.functions_total_expenses).toBe(86_662);
    expect(reconciliation.functions_operating_result).toBe(5_476);
    expect(reconciliation.functions_grants_and_contributions).toBe(33_427);
    expect(reconciliation.comprehensive_income_net_result).toBe(5_476);
    expect(reconciliation.comprehensive_other_income).toBe(22_090);
    expect(reconciliation.comprehensive_total).toBe(27_566);
    expect(reconciliation.revenue_components_sum).toBe(92_138);
    expect(reconciliation.expense_components_sum).toBe(66_869);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(9_213_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(8_666_200_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(2_486_200_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_979_300_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_817_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_524_800_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(96_800_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(254_900_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(3_403_600_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(236_800_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(547_600_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: MOREE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: MOREE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Moree Plains Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: MOREE_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Moree Plains Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^moree-plains-gpfs:/);
      expect(record.source_url).toContain('2911-2024-25-annual-financial-statement');
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
    expect(revenueComponents).toHaveLength(6);
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
    const broken = MOREE_FUNCTIONS_TEXT.replace(
      'Total functions and activities   92,138   104,824   86,662   92,188',
      'Total functions and activities   92,138   104,824   86,664   92,188',
    );
    const parsed = parseMoreeGpfsExtraction(extraction({ functions: broken }), MOREE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = MOREE_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council   27,566',
      'Total comprehensive income for the year attributable to Council   27,568',
    );
    const parsed = parseMoreeGpfsExtraction(extraction({ comprehensive: broken }), MOREE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = MOREE_INCOME_TEXT.replace(
      'Rates and annual charges   B2-1   34,036',
      'Rates and annual charges   B2-1   34,038',
    );
    const parsed = parseMoreeGpfsExtraction(extraction({ income: broken }), MOREE_CONTEXT);
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
    const url = MOREE_CONTEXT.document.url;
    const revenue = moreeGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = moreeGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^moree-plains-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(moreeGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(moreeGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_moreegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: MOREE_GPFS_ID,
    name: MOREE_GPFS_NAME,
    publisher: MOREE_GPFS_PUBLISHER,
    source_url: MOREE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: MOREE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'moree-plains-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Moree Plains Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: MOREE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-moree',
        project_name: 'Existing AusTender Moree Plains contract',
        delivery_entity: 'MOREE PLAINS SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-moree',
        project_name: 'Existing GrantConnect Moree Plains grant',
        delivery_entity: 'Moree Plains Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-moree-school',
        project_name: 'Existing data.nsw Moree school row (not a council row)',
        delivery_entity: 'Moree Secondary College',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-moree-charity',
        project_name: 'Existing ACNC Moree charity row (not the council)',
        delivery_entity: 'Moree Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: MOREE_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: MOREE_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    expect(
      await MeasureModel.countDocuments({
        source_id: MOREE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MOREE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MOREE_GPFS_ID,
        delivery_entity: { $ne: 'Moree Plains Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: MOREE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(16);
  });
});
