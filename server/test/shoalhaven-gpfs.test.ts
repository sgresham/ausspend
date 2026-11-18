import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  SHOALHAVEN_GPFS_DELIVERY_ENTITY,
  SHOALHAVEN_GPFS_FISCAL_YEAR,
  SHOALHAVEN_GPFS_ID,
  SHOALHAVEN_GPFS_LICENSE,
  SHOALHAVEN_GPFS_NAME,
  SHOALHAVEN_GPFS_PUBLISHER,
  SHOALHAVEN_GPFS_REPORTING_URL,
  detectShoalhavenGpfsUnit,
  discoverShoalhavenGpfsDocument,
  fiscalYearFromShoalhavenGpfsLink,
  parseShoalhavenGpfsExtraction,
  parseShoalhavenGpfsGridRecords,
  parseShoalhavenGpfsGridUrl,
  parseShoalhavenGpfsPreviousYearsLink,
  selectShoalhavenGpfsGridRecord,
  shoalhavenGpfsNaturalKey,
  type ShoalhavenGpfsParseContext,
} from '../src/connectors/shoalhaven-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './shoalhaven-gpfs.fixture.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so each value read is the first amount after the label (the
// FY2024-25 actual). The expense subtotal and the "operating result excluding
// depreciation" line both contain the phrase "depreciation, amortisation and
// impairment of non-financial assets", so the actual depreciation line is read
// from the last occurrence. The Income Statement does not print a combined
// total-expenses line; total expenses is the printed B1-1 "Total functions and
// activities" total, which equals the printed expenses-excluding-depreciation
// line plus the printed depreciation/impairment line.

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '74076e6f5b966575deb498e3805c9f5ff66aaa71ace5b001972f7d33313add20',
      bytes: 5_881_682,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 5),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 6),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
      textPage(DEPRECIATION_TEXT, 25),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://doc.shoalhaven.nsw.gov.au/LinkGeneratorAPI/record/10102076/preview_latest_final_version_pdf';

const CONTEXT: ShoalhavenGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statements 2024-2025',
    url: PDF_URL,
    fiscal_year: SHOALHAVEN_GPFS_FISCAL_YEAR,
    listing_url:
      'https://www.shoalhaven.nsw.gov.au/Council/Publicly-available-information/Finance/Financial-Statements-Previous-Years',
    reporting_url: SHOALHAVEN_GPFS_REPORTING_URL,
    record_uri: '10102076',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/shoalhaven-gpfs/shoalhaven-city-council-financial-statements-2024-25.pdf',
    sha256: '74076e6f5b966575deb498e3805c9f5ff66aaa71ace5b001972f7d33313add20',
    bytes: 5_881_682,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: SHOALHAVEN_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseShoalhavenGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Shoalhaven GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official pages, not a hard-coded PDF URL', () => {
    const reportingHtml = `
      <a href="/Council/Reports/Financial-statements">Financial statements</a>
      <a href="/Council/Publicly-available-information/Finance/Financial-Statements-Previous-Years">Financial Statements - Previous Years</a>
      <a href="https://doc.shoalhaven.nsw.gov.au/displaydoc.aspx?record=D26/485249">Annual Financial Statements 2025/26</a>
    `;
    const previousYearsHtml = `
      <p>Find Council's previous years audited Financial Statements.</p>
      <iframe id="myIframe" src="https://cm2web.shoalhaven.nsw.gov.au/CM2WebShare/Grid?id=b7ded5f0-513e-4675-b7fc-1268a5419269" height="1000px" width="1600px"></iframe>
    `;
    const gridJson = {
      id: 'b7ded5f0-513e-4675-b7fc-1268a5419269',
      records: [
        {
          tableFields: [
            { fieldName: 'Title', recordValue: 'Annual Financial Statements 2024-2025' },
            { fieldName: 'Size', recordValue: '5881682' },
          ],
          uri: '10102076',
          extension: 'PDF',
        },
        {
          tableFields: [
            { fieldName: 'Title', recordValue: 'Annual Financial Statements 2023 / 2024' },
            { fieldName: 'Size', recordValue: '8308249' },
          ],
          uri: '9439816',
          extension: 'PDF',
        },
      ],
    };

    expect(parseShoalhavenGpfsPreviousYearsLink(reportingHtml, SHOALHAVEN_GPFS_REPORTING_URL)).toBe(
      'https://www.shoalhaven.nsw.gov.au/Council/Publicly-available-information/Finance/Financial-Statements-Previous-Years',
    );
    expect(
      parseShoalhavenGpfsGridUrl(
        previousYearsHtml,
        'https://www.shoalhaven.nsw.gov.au/Council/Publicly-available-information/Finance/Financial-Statements-Previous-Years',
      ),
    ).toBe(
      'https://cm2web.shoalhaven.nsw.gov.au/CM2WebShare/Grid?id=b7ded5f0-513e-4675-b7fc-1268a5419269',
    );
    expect(parseShoalhavenGpfsGridRecords(gridJson)).toHaveLength(2);
    expect(
      selectShoalhavenGpfsGridRecord(parseShoalhavenGpfsGridRecords(gridJson), '2024-25'),
    ).toEqual({
      uri: '10102076',
      title: 'Annual Financial Statements 2024-2025',
      extension: 'PDF',
    });
    expect(fiscalYearFromShoalhavenGpfsLink('Annual Financial Statements 2024-2025')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromShoalhavenGpfsLink('Annual Financial Statements 2023 / 2024')).toBe(
      '2023-24',
    );
    expect(fiscalYearFromShoalhavenGpfsLink('2024/25 Financial Statements')).toBe('2024-25');
    expect(fiscalYearFromShoalhavenGpfsLink('2025/26 Annual Financial Statements')).toBe('2025-26');
  });

  it('resolves the record uri through the official document delivery endpoint', async () => {
    const discovered = await discoverShoalhavenGpfsDocument(globalThis.fetch, '2024-25', {
      reportingHtml:
        '<a href="/Council/Publicly-available-information/Finance/Financial-Statements-Previous-Years">Financial Statements - Previous Years</a>',
      previousYearsHtml:
        '<iframe src="https://cm2web.shoalhaven.nsw.gov.au/CM2WebShare/Grid?id=grid-1"></iframe>',
      gridJson: {
        records: [
          {
            tableFields: [
              { fieldName: 'Title', recordValue: 'Annual Financial Statements 2024-2025' },
            ],
            uri: '10102076',
            extension: 'PDF',
          },
        ],
      },
    });
    expect(discovered.title).toBe('Annual Financial Statements 2024-2025');
    expect(discovered.url).toBe(PDF_URL);
    expect(discovered.record_uri).toBe('10102076');
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const records = parseShoalhavenGpfsGridRecords({
      records: [
        {
          tableFields: [
            { fieldName: 'Title', recordValue: 'Annual Financial Statements 2023 / 2024' },
          ],
          uri: '9439816',
          extension: 'PDF',
        },
      ],
    });
    expect(() => selectShoalhavenGpfsGridRecord(records, '2024-25')).toThrow(/No published/);
  });
});

describe('Shoalhaven GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectShoalhavenGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectShoalhavenGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseShoalhavenGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Shoalhaven GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles them exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(418_722);
    expect(reconciliation.total_expenses).toBe(344_431);
    expect(reconciliation.employee_expenses).toBe(114_992);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(97_315);
    expect(reconciliation.government_grants_operating).toBe(21_125);
    expect(reconciliation.government_grants_capital).toBe(75_533);
    expect(reconciliation.net_result).toBe(74_291);
    expect(reconciliation.operating_result).toBe(74_291);
    expect(reconciliation.net_result_before_capital_grants).toBe(-1_242);
    // The repeated depreciation phrase must read the actual line (97,315),
    // never the expense subtotal (247,116) or the excluding-depreciation result.
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(247_116);
    expect(reconciliation.revenue_components_sum).toBe(418_722);
    expect(reconciliation.expense_components_sum).toBe(247_116);
    expect(reconciliation.face_expense_bridge).toBe(344_431);
    expect(reconciliation.functions_total_income).toBe(418_722);
    expect(reconciliation.functions_total_expenses).toBe(344_431);
    expect(reconciliation.functions_operating_result).toBe(74_291);
    expect(reconciliation.functions_grants_and_contributions).toBe(96_658);
    expect(reconciliation.comprehensive_income_net_result).toBe(74_291);
    expect(reconciliation.depreciation_note_total).toBe(97_315);
    expect(reconciliation.income_statement_page).toBe(5);
    expect(reconciliation.functions_page).toBe(14);
    expect(reconciliation.comprehensive_income_page).toBe(6);
    expect(reconciliation.depreciation_note_page).toBe(25);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(41_872_200_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(34_443_100_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(11_499_200_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      9_731_500_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_112_500_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(7_553_300_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(7_429_100_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      24_711_600_000,
    );
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
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
        source_id: SHOALHAVEN_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: SHOALHAVEN_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Shoalhaven City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Shoalhaven City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^shoalhaven-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    // Every row is non-additive agency detail; summing the printed rows is never the total.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace('344,431 355,219', '344,531 355,219');
    const parsed = parseShoalhavenGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('193,447 178,178', '193,547 178,178');
    const parsed = parseShoalhavenGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 74,291',
      'from Income Statement 74,000',
    );
    const parsed = parseShoalhavenGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = shoalhavenGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = shoalhavenGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^shoalhaven-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(shoalhavenGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(shoalhavenGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_shoalhavengpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: SHOALHAVEN_GPFS_ID,
    name: SHOALHAVEN_GPFS_NAME,
    publisher: SHOALHAVEN_GPFS_PUBLISHER,
    source_url: SHOALHAVEN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: SHOALHAVEN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'shoalhaven-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Shoalhaven GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: SHOALHAVEN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example1',
        verified: false,
        natural_key: 'aus-tender-Shoalhaven-City-Council-existing-1',
        project_name: 'Existing AusTender contract under the exact string Shoalhaven City Council',
        delivery_entity: 'Shoalhaven City Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect-SHOALHAVEN-existing',
        project_name: 'Existing GrantConnect grant to a different Shoalhaven organisation',
        delivery_entity: 'SHOALHAVEN COMMUNITY ARTS CENTRE',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-shoalhaven-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Shoalhaven Men’s Shed',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'tweed-shire-gpfs',
        source_url: 'https://www.tweed.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-tweed-gpfs-1',
        project_name: 'Existing Tweed Shire GPFS row',
        delivery_entity: 'Tweed Shire Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-shoalhaven-project',
        project_name: 'Existing NSW Budget project whose name mentions Shoalhaven',
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
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'tweed-shire-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: SHOALHAVEN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'acnc-charity', 'nsw-budget'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.amount_cents)).toEqual([
      654_321, 42_000_000, 999_000, 128_500,
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: SHOALHAVEN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);
    // The pre-existing AusTender row keeps the exact string "Shoalhaven City
    // Council". It is preserved untouched and never summed with the 17 GPFS rows
    // (which also carry that published entity name but a different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'Shoalhaven City Council',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Shoalhaven City Council' })).toBe(
      18,
    );

    expect(
      await MeasureModel.countDocuments({
        source_id: SHOALHAVEN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: SHOALHAVEN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: SHOALHAVEN_GPFS_ID,
        delivery_entity: { $ne: 'Shoalhaven City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: SHOALHAVEN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
