import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  NORTH_SYDNEY_GPFS_DELIVERY_ENTITY,
  NORTH_SYDNEY_GPFS_FISCAL_YEAR,
  NORTH_SYDNEY_GPFS_ID,
  NORTH_SYDNEY_GPFS_LICENSE,
  NORTH_SYDNEY_GPFS_NAME,
  NORTH_SYDNEY_GPFS_PUBLISHER,
  NORTH_SYDNEY_GPFS_REPORTING_URL,
  detectNorthSydneyGpfsUnit,
  discoverNorthSydneyGpfsDocument,
  fiscalYearFromNorthSydneyGpfsLink,
  northSydneyGpfsNaturalKey,
  parseNorthSydneyGpfsExtraction,
  parseNorthSydneyGpfsReportPage,
  type NorthSydneyGpfsParseContext,
} from '../src/connectors/north-sydney-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_ITEMS,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './north-sydney-gpfs.fixture.js';

// The Income Statement prints the Original unaudited budget amount before each
// line label in the PDF text stream, so each emitted value is the first amount
// after the label (the FY2024-25 actual). The expense subtotal contains the
// phrase "depreciation, amortisation and impairment of non-financial assets", so
// the actual depreciation line is read from the last occurrence. Total expenses
// is the printed B1-1 total, which equals the face-statement bridge exactly.
// B1-1's horizontal table is read from the printed total-column coordinates.

function textPage(text: string, pageNumber: number, items: PdfPage['items'] = []): PdfPage {
  return { page_number: pageNumber, text, items };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '37c7de1f8114ff91b0a9643b5f607bdc21af5394ec7d54c14c55e90740d8d72f',
      bytes: 12_205_070,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 9),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 10),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 18, FUNCTIONS_ITEMS),
      textPage(DEPRECIATION_TEXT, 30),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.northsydney.nsw.gov.au/downloads/file/4517/financial-statements-2024-2025';

const CONTEXT: NorthSydneyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024-2025',
    url: PDF_URL,
    fiscal_year: NORTH_SYDNEY_GPFS_FISCAL_YEAR,
    listing_url: NORTH_SYDNEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/north-sydney-gpfs/north-sydney-council-financial-statements-2024-25.pdf',
    sha256: '37c7de1f8114ff91b0a9643b5f607bdc21af5394ec7d54c14c55e90740d8d72f',
    bytes: 12_205_070,
    fetched_at: '2026-11-18T05:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: NORTH_SYDNEY_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseNorthSydneyGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('North Sydney GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official listing, not a hard-coded PDF URL', () => {
    const indexHtml = `
      <a href="/downloads/file/3864/financial-statements-2023-2024">Financial Statements 2023-2024 PDF 7.38MB Download</a>
      <a href="/downloads/file/4517/financial-statements-2024-2025">Financial Statements 2024-2025 PDF 11.64MB Download</a>
      <a href="/downloads/file/4497/annual-report-2024-2025">Annual Report 2024-2025 PDF 20MB Download</a>
    `;
    expect(
      parseNorthSydneyGpfsReportPage(indexHtml, NORTH_SYDNEY_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: PDF_URL,
      title: 'Financial Statements 2024-2025',
    });
    expect(fiscalYearFromNorthSydneyGpfsLink('Financial Statements 2024-2025')).toBe('2024-25');
    expect(fiscalYearFromNorthSydneyGpfsLink('Financial Statements 2023-2024')).toBe('2023-24');
    expect(fiscalYearFromNorthSydneyGpfsLink('Financial Statements 2025/26')).toBe('2025-26');
    expect(fiscalYearFromNorthSydneyGpfsLink('Annual Report 2024 to 2025')).toBe('2024-25');
  });

  it('resolves the PDF through the official document listing', async () => {
    const discovered = await discoverNorthSydneyGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: `<a href="/downloads/file/4517/financial-statements-2024-2025">Financial Statements 2024-2025 PDF 11.64MB Download</a>`,
    });
    expect(discovered.title).toBe('Financial Statements 2024-2025');
    expect(discovered.url).toBe(PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(NORTH_SYDNEY_GPFS_REPORTING_URL);
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    expect(
      parseNorthSydneyGpfsReportPage(
        '<a href="/downloads/file/3864/financial-statements-2023-2024">Financial Statements 2023-2024</a>',
        NORTH_SYDNEY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parseNorthSydneyGpfsReportPage(
        '<a href="https://example.com/financial-statements-2024-2025">Financial Statements 2024-2025</a>',
        NORTH_SYDNEY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('North Sydney GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectNorthSydneyGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectNorthSydneyGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseNorthSydneyGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('North Sydney GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement and B1-1 exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(18);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(154_580);
    expect(reconciliation.total_expenses).toBe(139_403);
    expect(reconciliation.employee_expenses).toBe(48_080);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(30_411);
    expect(reconciliation.government_grants_operating).toBe(4_869);
    expect(reconciliation.government_grants_capital).toBe(13_909);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(883);
    expect(reconciliation.net_share_of_joint_ventures).toBe(1);
    expect(reconciliation.net_result).toBe(15_177);
    expect(reconciliation.operating_result).toBe(15_177);
    expect(reconciliation.net_result_before_capital_grants).toBe(1_268);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(108_992);
    expect(reconciliation.revenue_components_sum).toBe(154_580);
    expect(reconciliation.expense_components_sum).toBe(108_992);
    expect(reconciliation.face_expense_bridge).toBe(139_403);
    expect(reconciliation.functions_total_income).toBe(154_580);
    expect(reconciliation.functions_total_expenses).toBe(139_403);
    expect(reconciliation.functions_operating_result).toBe(15_177);
    expect(reconciliation.functions_grants_and_contributions).toBe(18_778);
    expect(reconciliation.comprehensive_income_net_result).toBe(15_177);
    expect(reconciliation.depreciation_note_total).toBe(29_086);
    expect(reconciliation.impairment_note_total).toBe(1_325);
    expect(reconciliation.income_statement_page).toBe(9);
    expect(reconciliation.functions_page).toBe(18);
    expect(reconciliation.comprehensive_income_page).toBe(10);
    expect(reconciliation.depreciation_note_page).toBe(30);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(15_458_000_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(13_940_300_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(4_808_000_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      3_041_100_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(486_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_390_900_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(88_300_000);
    expect(recordByLine(records, 'net_share_of_joint_ventures').amount_cents).toBe(100_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(1_517_700_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      10_899_200_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(7_982_000_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').notes).not.toContain('human_spot_check');
    // The printed before-capital surplus is evidence only and is not a row.
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('emits only printed categories: components point at their printed subtotal and there is no region/LGA allocation', () => {
    const { records } = parsedFixture();
    const keys = records.map((record) => record.gpfs_line_item).sort();
    expect(keys).toEqual(
      [
        'borrowing_costs',
        'depreciation_amortisation_impairment',
        'employee_expenses',
        'government_grants_capital',
        'government_grants_operating',
        'interest_and_investment_income',
        'materials_and_services',
        'net_loss_from_disposal_of_assets',
        'net_share_of_joint_ventures',
        'net_result',
        'other_expenses',
        'other_income',
        'other_revenues',
        'rates_and_annual_charges',
        'total_expenses',
        'total_expenses_excluding_depreciation',
        'total_revenue',
        'user_charges_and_fees',
      ].sort(),
    );
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: NORTH_SYDNEY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: NORTH_SYDNEY_GPFS_DELIVERY_ENTITY,
        source_dataset: 'North Sydney Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('North Sydney Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^north-sydney-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'net_share_of_joint_ventures').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const brokenItems = FUNCTIONS_ITEMS.map((item) =>
      item.str === '139,403' ? { ...item, str: '139,303' } : item,
    );
    const broken = { ...extraction(), pages: extraction().pages };
    broken.pages[2] = textPage(FUNCTIONS_TEXT, 18, brokenItems);
    const parsed = parseNorthSydneyGpfsExtraction(broken, CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('79,820 75,559', '79,920 75,559');
    const parsed = parseNorthSydneyGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 15,177',
      'from Income Statement 15,000',
    );
    const parsed = parseNorthSydneyGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-4 depreciation plus impairment no longer bridges', () => {
    const broken = DEPRECIATION_TEXT.replace('29,086 28,240', '28,086 28,240');
    const pages = extraction().pages;
    pages[3] = textPage(broken, 30);
    const parsed = parseNorthSydneyGpfsExtraction({ ...extraction(), pages }, CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('is deterministic and derives stable, line-specific natural keys', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
    const url = CONTEXT.document.url;
    const revenue = northSydneyGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = northSydneyGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^north-sydney-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(northSydneyGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(northSydneyGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_northsydneygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: NORTH_SYDNEY_GPFS_ID,
    name: NORTH_SYDNEY_GPFS_NAME,
    publisher: NORTH_SYDNEY_GPFS_PUBLISHER,
    source_url: NORTH_SYDNEY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: NORTH_SYDNEY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'north-sydney-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('North Sydney GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: NORTH_SYDNEY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-North-Sydney-Council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string North Sydney Council',
        delivery_entity: 'North Sydney Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-NORTH-SYDNEY-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase NORTH SYDNEY COUNCIL',
        delivery_entity: 'NORTH SYDNEY COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-north-sydney-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'North Sydney Community Aid Association',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'ryde-gpfs',
        source_url: 'https://www.ryde.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-ryde-gpfs-1',
        project_name: 'Existing Council of the City of Ryde GPFS row',
        delivery_entity: 'Council of the City of Ryde',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-north-sydney-project',
        project_name: 'Existing NSW Budget project whose name mentions North Sydney',
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
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'ryde-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: NORTH_SYDNEY_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(23);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: NORTH_SYDNEY_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(23);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'North Sydney Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'NORTH SYDNEY COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'North Sydney Council' })).toBe(19);
    expect(await MeasureModel.countDocuments({ delivery_entity: /^north sydney council$/i })).toBe(
      20,
    );

    expect(
      await MeasureModel.countDocuments({
        source_id: NORTH_SYDNEY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NORTH_SYDNEY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NORTH_SYDNEY_GPFS_ID,
        delivery_entity: { $ne: 'North Sydney Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: NORTH_SYDNEY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
