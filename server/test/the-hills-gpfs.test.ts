import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  THE_HILLS_GPFS_DELIVERY_ENTITY,
  THE_HILLS_GPFS_FISCAL_YEAR,
  THE_HILLS_GPFS_ID,
  THE_HILLS_GPFS_LICENSE,
  THE_HILLS_GPFS_NAME,
  THE_HILLS_GPFS_PUBLISHER,
  THE_HILLS_GPFS_REPORTING_URL,
  detectTheHillsGpfsUnit,
  discoverTheHillsGpfsDocument,
  fiscalYearFromTheHillsGpfsLink,
  parseTheHillsGpfsExtraction,
  parseTheHillsGpfsReportPage,
  theHillsGpfsNaturalKey,
  type TheHillsGpfsParseContext,
} from '../src/connectors/the-hills-gpfs/index.js';
import {
  THE_HILLS_COMPREHENSIVE_TEXT,
  THE_HILLS_DEPRECIATION_TEXT,
  THE_HILLS_FUNCTIONS_TEXT,
  THE_HILLS_INCOME_TEXT,
  THE_HILLS_PDF_SHA256,
  THE_HILLS_PDF_URL,
  theHillsExtraction,
} from '../src/connectors/the-hills-gpfs/fixture-data.js';
import { THE_HILLS_GPFS_ROW_COUNT } from '../src/connectors/the-hills-gpfs/fixture.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so the FY2024-25 actual is the first amount after the label. Total
// expenses is the printed face-statement bridge: printed expenses excluding
// depreciation plus printed depreciation, equal to the printed B1-1 total.

const CONTEXT: TheHillsGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'The Hills Shire Council Financial Statements 2024-25',
    url: THE_HILLS_PDF_URL,
    fiscal_year: THE_HILLS_GPFS_FISCAL_YEAR,
    listing_url: THE_HILLS_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/the-hills-gpfs/the-hills-shire-council-financial-statements-2024-25.pdf',
    sha256: THE_HILLS_PDF_SHA256,
    bytes: 5_589_503,
    fetched_at: '2026-11-18T03:30:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: THE_HILLS_GPFS_REPORTING_URL,
};

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: THE_HILLS_PDF_SHA256,
      bytes: 5_589_503,
    },
    pages: [
      textPage(overrides.income ?? THE_HILLS_INCOME_TEXT, 7),
      textPage(overrides.comprehensive ?? THE_HILLS_COMPREHENSIVE_TEXT, 8),
      textPage(overrides.functions ?? THE_HILLS_FUNCTIONS_TEXT, 16),
      textPage(THE_HILLS_DEPRECIATION_TEXT, 27),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

function parsedFixture() {
  return parseTheHillsGpfsExtraction(theHillsExtraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('The Hills GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official page, not a hard-coded PDF URL', () => {
    const indexHtml = `
      <h2>Annual Report Archive</h2>
      <a href="https://www.thehills.nsw.gov.au/files/assets/public/v/1/cms-docs/council/key-docs/annual-report-amp-archive/2023-2024/annual-report-2023-2024.pdf">The Hills Shire Council Annual Report 2023-2024</a>
      <a href="https://www.thehills.nsw.gov.au/files/assets/public/v/1/cms-docs/council/key-docs/annual-report-amp-archive/2023-2024/financial-statements-2023-2024.pdf">The Hills Shire Council Financial Statements 2023-2024</a>
      <a href="https://www.thehills.nsw.gov.au/files/assets/public/v/1/cms-docs/council/key-docs/annual-report-amp-archive/2025-2026/the-hills-shire-council-financial-statements-2025-2026.pdf">The Hills Shire Council Financial Statements 2025-2026</a>
      <a href="${THE_HILLS_PDF_URL}">The Hills Shire Council Financial Statements 2024-2025</a>
    `;
    expect(parseTheHillsGpfsReportPage(indexHtml, THE_HILLS_GPFS_REPORTING_URL, '2024-25')).toEqual(
      {
        pdfUrl: THE_HILLS_PDF_URL,
        title:
          'The Hills Shire Council Financial Statements 2024-25 (General Purpose Financial Statements)',
      },
    );
    expect(fiscalYearFromTheHillsGpfsLink('2024-25 Financial Statements')).toBe('2024-25');
    expect(fiscalYearFromTheHillsGpfsLink('financial-statements-2024-25.pdf')).toBe('2024-25');
    // The archive PDF filename itself carries the year pair.
    expect(
      fiscalYearFromTheHillsGpfsLink('the-hills-shire-council-financial-statements-2024-2025.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromTheHillsGpfsLink('the-hills-shire-council-annual-report-2024-2025.pdf'),
    ).toBe('2024-25');
    expect(fiscalYearFromTheHillsGpfsLink('Financial Statements - 2025/26')).toBe('2025-26');
    expect(fiscalYearFromTheHillsGpfsLink('Year ended 30 June 2025')).toBe('2024-25');
  });

  it('resolves the PDF through the official page HTML', async () => {
    const discovered = await discoverTheHillsGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml:
        '<a href="https://www.thehills.nsw.gov.au/files/assets/public/v/1/cms-docs/council/key-docs/annual-report-amp-archive/2024-2025/the-hills-shire-council-financial-statements-2024-2025.pdf">The Hills Shire Council Financial Statements 2024-2025</a>',
    });
    expect(discovered.title).toBe(
      'The Hills Shire Council Financial Statements 2024-25 (General Purpose Financial Statements)',
    );
    expect(discovered.url).toBe(THE_HILLS_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(THE_HILLS_GPFS_REPORTING_URL);
  });

  it('does not select a prior-year, later-year or non-financial-statements link', () => {
    expect(
      parseTheHillsGpfsReportPage(
        '<a href="https://www.thehills.nsw.gov.au/files/assets/public/v/1/cms-docs/council/key-docs/annual-report-amp-archive/2023-2024/financial-statements-2023-2024.pdf">The Hills Shire Council Financial Statements 2023-2024</a>',
        THE_HILLS_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
    expect(
      parseTheHillsGpfsReportPage(
        '<a href="https://www.thehills.nsw.gov.au/files/assets/public/v/1/cms-docs/council/key-docs/annual-report-amp-archive/2025-2026/the-hills-shire-council-financial-statements-2025-2026.pdf">The Hills Shire Council Financial Statements 2025-2026</a>',
        THE_HILLS_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
    expect(
      parseTheHillsGpfsReportPage(
        '<a href="https://www.thehills.nsw.gov.au/files/assets/public/v/1/cms-docs/council/key-docs/annual-report-amp-archive/2024-2025/the-hills-shire-council-annual-report-2024-2025.pdf">The Hills Shire Council Annual Report 2024-2025</a>',
        THE_HILLS_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parseTheHillsGpfsReportPage(
        '<a href="https://example.com/the-hills-shire-council-financial-statements-2024-2025.pdf">The Hills Shire Council Financial Statements 2024-2025</a>',
        THE_HILLS_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('The Hills GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectTheHillsGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectTheHillsGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = THE_HILLS_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseTheHillsGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('The Hills GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(417_451);
    expect(reconciliation.total_expenses).toBe(221_057);
    expect(reconciliation.employee_expenses).toBe(81_713);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(30_232);
    expect(reconciliation.government_grants_operating).toBe(18_992);
    expect(reconciliation.government_grants_capital).toBe(167_184);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(3_102);
    expect(reconciliation.net_result).toBe(196_394);
    expect(reconciliation.operating_result).toBe(196_394);
    expect(reconciliation.net_result_before_capital_grants).toBe(29_210);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(190_825);
    expect(reconciliation.revenue_components_sum).toBe(417_451);
    expect(reconciliation.expense_components_sum).toBe(190_825);
    expect(reconciliation.face_expense_bridge).toBe(221_057);
    expect(reconciliation.functions_total_income).toBe(417_451);
    expect(reconciliation.functions_total_expenses).toBe(221_057);
    expect(reconciliation.functions_operating_result).toBe(196_394);
    expect(reconciliation.functions_grants_and_contributions).toBe(186_176);
    expect(reconciliation.comprehensive_income_net_result).toBe(196_394);
    expect(reconciliation.depreciation_note_total).toBe(30_232);
    expect(reconciliation.income_statement_page).toBe(7);
    expect(reconciliation.functions_page).toBe(16);
    expect(reconciliation.comprehensive_income_page).toBe(8);
    expect(reconciliation.depreciation_note_page).toBe(27);
    expect(parsed.rejections).toEqual([]);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(41_745_100_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(22_105_700_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(8_171_300_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      3_023_200_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_899_200_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(16_718_400_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      310_200_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(19_639_400_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      19_082_500_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(14_400_800_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
    // The printed before-capital result is evidence only and is not a row.
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
        'net_gain_from_disposal_of_assets',
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
        source_id: THE_HILLS_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: THE_HILLS_GPFS_DELIVERY_ENTITY,
        source_dataset: 'The Hills Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('The Hills Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^the-hills-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'employee_expenses').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    // Every row is non-additive agency detail; summing the printed rows is never the total.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 totals no longer reconcile', () => {
    const broken = THE_HILLS_FUNCTIONS_TEXT.replace(
      '417,451 383,483 221,057 221,772 196,394 161,711',
      '417,451 383,483 221,000 221,772 196,394 161,711',
    );
    const parsed = parseTheHillsGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = THE_HILLS_INCOME_TEXT.replace('144,008 128,728', '144,000 128,728');
    const parsed = parseTheHillsGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = THE_HILLS_COMPREHENSIVE_TEXT.replace(
      'from Income Statement 196,394',
      'from Income Statement 196,000',
    );
    const parsed = parseTheHillsGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
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
    const revenue = theHillsGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = theHillsGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^the-hills-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(theHillsGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(theHillsGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_thehillsgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: THE_HILLS_GPFS_ID,
    name: THE_HILLS_GPFS_NAME,
    publisher: THE_HILLS_GPFS_PUBLISHER,
    source_url: THE_HILLS_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: THE_HILLS_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'the-hills-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('The Hills GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: THE_HILLS_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-the-hills-shire-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string The Hills Shire Council',
        delivery_entity: 'The Hills Shire Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-the-hills-shire-council-existing',
        project_name: 'Existing AusTender contract under the uppercase THE HILLS SHIRE COUNCIL',
        delivery_entity: 'THE HILLS SHIRE COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-the-hills-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'The Hills Community Aid Association',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'blacktown-gpfs',
        source_url: 'https://www.blacktown.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-blacktown-gpfs-1',
        project_name: 'Existing Blacktown City Council GPFS row',
        delivery_entity: 'Blacktown City Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-the-hills-project',
        project_name: 'Existing NSW Budget project whose name mentions The Hills',
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
    expect(await MeasureModel.countDocuments({ source_id: 'blacktown-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: THE_HILLS_GPFS_ID })).toBe(
      THE_HILLS_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(22);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'acnc-charity', 'nsw-budget'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.amount_cents)).toEqual([
      654_321, 128_500, 999_000, 42_000_000,
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: THE_HILLS_GPFS_ID })).toBe(
      THE_HILLS_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(22);
    // The pre-existing GrantConnect row keeps the exact string and the AusTender
    // row the uppercase form. Both are preserved untouched and never summed
    // with the 17 GPFS rows (which also carry that published entity name but a
    // different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'The Hills Shire Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'THE HILLS SHIRE COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'The Hills Shire Council' })).toBe(
      18,
    );

    expect(
      await MeasureModel.countDocuments({
        source_id: THE_HILLS_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: THE_HILLS_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: THE_HILLS_GPFS_ID,
        delivery_entity: { $ne: 'The Hills Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: THE_HILLS_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(THE_HILLS_GPFS_ROW_COUNT);
  });
});
