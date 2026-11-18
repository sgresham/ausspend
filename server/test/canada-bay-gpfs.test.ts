import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  CANADA_BAY_GPFS_DELIVERY_ENTITY,
  CANADA_BAY_GPFS_FISCAL_YEAR,
  CANADA_BAY_GPFS_ID,
  CANADA_BAY_GPFS_LICENSE,
  CANADA_BAY_GPFS_NAME,
  CANADA_BAY_GPFS_PUBLISHER,
  CANADA_BAY_GPFS_REPORTING_URL,
  canadaBayGpfsNaturalKey,
  detectCanadaBayGpfsUnit,
  discoverCanadaBayGpfsDocument,
  fiscalYearFromCanadaBayGpfsLink,
  parseCanadaBayGpfsExtraction,
  parseCanadaBayGpfsReportPage,
  type CanadaBayGpfsParseContext,
} from '../src/connectors/canada-bay-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './canada-bay-gpfs.fixture.js';

// Canada Bay publishes its audited financial reports inside its Annual Report.
// The Income Statement prints the Original unaudited budget amount before each
// line label in the PDF text stream, so each emitted value is the first amount
// after the label (the FY2024-25 actual). The expense subtotal contains the
// phrase "depreciation, amortisation and impairment of non-financial assets", so
// the actual depreciation line is read from the last occurrence. Total expenses
// is the printed B1-1 total, which equals the face-statement bridge exactly.

function textPage(text: string, pageNumber: number, items: PdfPage['items'] = []): PdfPage {
  return { page_number: pageNumber, text, items };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'c83a0b579bf0f3bb493f154f2ef1cc089fe5490b844d5ad62d6ff0a400ab9776',
      bytes: 35_521_573,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 133),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 134),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 142),
      textPage(DEPRECIATION_TEXT, 155),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://canadabay.t1cloud.com/T1Default/CiAnywhere/Web/CANADABAY/API/CMIS/PUB/content/?id=folder-8769276&streamId=streampdf-8769276';

const CONTEXT: CanadaBayGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Report 2024-2025',
    url: PDF_URL,
    fiscal_year: CANADA_BAY_GPFS_FISCAL_YEAR,
    listing_url: CANADA_BAY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/canada-bay-gpfs/canada-bay-council-annual-report-2024-25.pdf',
    sha256: 'c83a0b579bf0f3bb493f154f2ef1cc089fe5490b844d5ad62d6ff0a400ab9776',
    bytes: 35_521_573,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: CANADA_BAY_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseCanadaBayGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('City of Canada Bay GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official Our Reporting page, not a hard-coded PDF URL', () => {
    const pageHtml = `
      <a href="https://canadabay.t1cloud.com/example/streamId=streampdf-8397609">Annual Report 2023-2024</a>
      <a href="https://canadabay.t1cloud.com/T1Default/CiAnywhere/Web/CANADABAY/API/CMIS/PUB/content/?id=folder-8769276&amp;streamId=streampdf-8769276">Annual Report 2024-2025</a>
      <a href="/sites/default/files/State_of_the_Bay_Annual_Report_2017.pdf">State of the Bay 2017 – Annual Report</a>
    `;
    expect(
      parseCanadaBayGpfsReportPage(pageHtml, CANADA_BAY_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: PDF_URL,
      title: 'Annual Report 2024-2025',
    });
    expect(fiscalYearFromCanadaBayGpfsLink('Annual Report 2024-2025')).toBe('2024-25');
    expect(fiscalYearFromCanadaBayGpfsLink('Annual Report 2023-2024')).toBe('2023-24');
    expect(fiscalYearFromCanadaBayGpfsLink('Annual Report 2025/26')).toBe('2025-26');
    expect(fiscalYearFromCanadaBayGpfsLink('Annual Report 2024 to 2025')).toBe('2024-25');
    expect(fiscalYearFromCanadaBayGpfsLink('Financial statements year ended 30 June 2025')).toBe(
      '2024-25',
    );
  });

  it('resolves the PDF through the official listing', async () => {
    const discovered = await discoverCanadaBayGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: `<a href="https://canadabay.t1cloud.com/example/streamId=streampdf-1">Annual Report 2024-2025</a>`,
    });
    expect(discovered.title).toBe('Annual Report 2024-2025');
    expect(discovered.url).toBe('https://canadabay.t1cloud.com/example/streamId=streampdf-1');
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(CANADA_BAY_GPFS_REPORTING_URL);
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    expect(
      parseCanadaBayGpfsReportPage(
        '<a href="https://canadabay.t1cloud.com/example/streamId=streampdf-1">Annual Report 2023-2024</a>',
        CANADA_BAY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects an annual-report link on a non-council host', () => {
    expect(
      parseCanadaBayGpfsReportPage(
        '<a href="https://example.com/annual-report-2024-2025.pdf">Annual Report 2024-2025</a>',
        CANADA_BAY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('City of Canada Bay GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectCanadaBayGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectCanadaBayGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseCanadaBayGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('City of Canada Bay GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1 and note B3-4 exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(201_079);
    expect(reconciliation.total_expenses).toBe(131_001);
    expect(reconciliation.employee_expenses).toBe(51_227);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(18_953);
    expect(reconciliation.government_grants_operating).toBe(6_520);
    expect(reconciliation.government_grants_capital).toBe(66_670);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(3_684);
    expect(reconciliation.net_result).toBe(70_078);
    expect(reconciliation.operating_result).toBe(70_078);
    expect(reconciliation.net_result_before_capital_grants).toBe(3_408);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(112_048);
    expect(reconciliation.revenue_components_sum).toBe(201_079);
    expect(reconciliation.expense_components_sum).toBe(112_048);
    expect(reconciliation.face_expense_bridge).toBe(131_001);
    expect(reconciliation.functions_total_income).toBe(201_079);
    expect(reconciliation.functions_total_expenses).toBe(131_001);
    expect(reconciliation.functions_operating_result).toBe(70_078);
    expect(reconciliation.functions_grants_and_contributions).toBe(73_190);
    expect(reconciliation.comprehensive_income_net_result).toBe(70_078);
    expect(reconciliation.comprehensive_income_total).toBe(155_463);
    expect(reconciliation.depreciation_note_total).toBe(18_953);
    expect(reconciliation.depreciation_impairment_note_total).toBe(18_953);
    expect(reconciliation.income_statement_page).toBe(133);
    expect(reconciliation.functions_page).toBe(142);
    expect(reconciliation.comprehensive_income_page).toBe(134);
    expect(reconciliation.depreciation_note_page).toBe(155);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(20_107_900_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(13_100_100_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(5_122_700_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_895_300_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(652_000_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(6_667_000_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      368_400_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(7_007_800_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      11_204_800_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(7_158_500_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
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
        source_id: CANADA_BAY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: CANADA_BAY_GPFS_DELIVERY_ENTITY,
        source_dataset: 'City of Canada Bay Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('City of Canada Bay Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^canada-bay-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const broken = FUNCTIONS_TEXT.replace(
      'Total functions and activities 201,079 179,904 131,001',
      'Total functions and activities 201,079 179,904 131,101',
    );
    const parsed = parseCanadaBayGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('71,585 67,310', '71,685 67,310');
    const parsed = parseCanadaBayGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 70,078',
      'from Income Statement 70,000',
    );
    const parsed = parseCanadaBayGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-4 depreciation no longer bridges', () => {
    const broken = DEPRECIATION_TEXT.replace(
      'Total depreciation and amortisation costs 18,953 17,763',
      'Total depreciation and amortisation costs 18,853 17,763',
    );
    const parsed = parseCanadaBayGpfsExtraction(extraction({}), CONTEXT);
    const brokenExtraction = extraction();
    brokenExtraction.pages[3] = textPage(broken, 155);
    const parsedBroken = parseCanadaBayGpfsExtraction(brokenExtraction, CONTEXT);
    expect(parsed.records).toHaveLength(17);
    expect(parsedBroken.records).toEqual([]);
    expect(parsedBroken.reconciliation).toBeNull();
    expect(parsedBroken.rejections[0]!.reason).toMatch(/reconciliation failed/);
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
    const revenue = canadaBayGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = canadaBayGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^canada-bay-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(canadaBayGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(canadaBayGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_canadabaygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CANADA_BAY_GPFS_ID,
    name: CANADA_BAY_GPFS_NAME,
    publisher: CANADA_BAY_GPFS_PUBLISHER,
    source_url: CANADA_BAY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CANADA_BAY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'canada-bay-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('City of Canada Bay GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: CANADA_BAY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-canada-bay-council-existing-1',
        project_name:
          'Existing GrantConnect grant under the exact string City of Canada Bay Council',
        delivery_entity: 'City of Canada Bay Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-CITY-OF-CANADA-BAY-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase CITY OF CANADA BAY COUNCIL',
        delivery_entity: 'CITY OF CANADA BAY COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-canada-bay-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'City of Canada Bay Community Aid Association',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'north-sydney-gpfs',
        source_url: 'https://www.northsydney.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-north-sydney-gpfs-1',
        project_name: 'Existing North Sydney Council GPFS row',
        delivery_entity: 'North Sydney Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-canada-bay-project',
        project_name: 'Existing NSW Budget project whose name mentions Canada Bay',
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
    expect(await MeasureModel.countDocuments({ source_id: 'north-sydney-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: CANADA_BAY_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: CANADA_BAY_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'City of Canada Bay Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'CITY OF CANADA BAY COUNCIL',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: 'City of Canada Bay Council' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: /^city of canada bay council$/i }),
    ).toBe(19);

    expect(
      await MeasureModel.countDocuments({
        source_id: CANADA_BAY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CANADA_BAY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CANADA_BAY_GPFS_ID,
        delivery_entity: { $ne: 'City of Canada Bay Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: CANADA_BAY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
