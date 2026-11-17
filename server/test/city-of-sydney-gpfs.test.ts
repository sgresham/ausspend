import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  CITY_OF_SYDNEY_GPFS_FISCAL_YEAR,
  CITY_OF_SYDNEY_GPFS_ID,
  CITY_OF_SYDNEY_GPFS_LICENSE,
  CITY_OF_SYDNEY_GPFS_NAME,
  CITY_OF_SYDNEY_GPFS_PUBLISHER,
  CITY_OF_SYDNEY_GPFS_REPORTING_URL,
  cityOfSydneyGpfsNaturalKey,
  detectCityOfSydneyGpfsUnit,
  fiscalYearFromSydneyGpfsLink,
  parseCityOfSydneyGpfsExtraction,
  parseCityOfSydneyGpfsReportLinks,
  selectCityOfSydneyGpfsDocument,
  type CityOfSydneyGpfsParseContext,
} from '../src/connectors/city-of-sydney-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (pp. 6, 7 and 16). The
// income statement prints the Budget 2025 column *before* the label, so a parser
// that took the first number in the line would read the budget; the expected
// values below are all Actual 2025.
const INCOME_TEXT = `Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 419,230 Rates and annual charges B2-1 420,955 397,592 149,206 User charges and fees B2-2 162,346 163,152 42,362 Other revenue B2-3 50,103 41,915 17,477 Grants and contributions provided for operating purposes B2-4 15,652 16,508 95,048 Grants and contributions provided for capital purposes B2-4 111,331 117,839 34,285 Interest and investment income B2-5 39,676 39,591 88,075 Other income B2-6 109,685 100,738 – Net gain from the disposal of assets B4-1 – 17,242 845,683 Total income from continuing operations 909,748 894,577 Expenses from continuing operations 289,337 Employee benefits and on-costs B3-1 306,623 276,897 244,959 Materials and services B3-2 286,173 299,048 – Borrowing costs B3-3 211 216 69,197 Other expenses B3-5 46,497 46,557 – Net loss from the disposal of assets B4-1 6,568 – 603,493 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 646,072 622,718 242,190 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 263,676 271,859 126,789 Depreciation, amortisation and impairment of non-financial assets B3-4 130,214 123,938 115,401 Operating result from continuing operations 133,462 147,921 115,401 Net operating result for the year attributable to Council 133,462 147,921 20,353 Net operating result for the year before grants and contributions provided for capital purposes 22,131 30,082 The above Income Statement should be read in conjunction with the accompanying notes. Council of the City of Sydney Income Statement for the year ended 30 June 2025 Page 6`;

const COMPREHENSIVE_TEXT = `$ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 133,462 147,921 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-8 1,116,252 369,891 Movement in Trust Assets reserve - Crown land revaluation C1-8 201,866 160,390 Total items which will not be reclassified subsequent to operating result 1,318,118 530,281 Total comprehensive income for the year attributable to Council 1,451,580 678,202 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Council of the City of Sydney Statement of Comprehensive Income for the year ended 30 June 2025 Page 7`;

const FUNCTIONS_TEXT = `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions 1 Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Responsible governance and stewardship 193,108 194,312 273,070 266,389 (79,962) (72,077) 2,024 2,184 6,147,027 5,614,380 A leading environmental performer 4,203 3,623 110,016 108,064 (105,813) (104,441) 3,059 2,369 404,582 394,830 Public places for all 123,170 123,682 170,745 161,978 (47,575) (38,296) 59,476 60,091 10,011,528 9,002,511 Design excellence and sustainable development 20,816 23,958 50,708 49,211 (29,892) (25,253) 15,568 12,168 180,720 204,989 A city for walking, cycling and public transport 95,875 100,961 15,497 15,423 80,378 85,538 23,809 35,946 82,893 82,512 An equitable and inclusive city 15,393 13,945 49,525 43,863 (34,132) (29,918) 13,195 11,979 2,079 2,214 Resilient and diverse communities 58,420 58,197 57,175 56,452 1,245 1,745 2,273 2,429 5,336 3,135 A thriving cultural and creative life 5,421 1,559 14,912 12,662 (9,491) (11,103) 2,415 697 70,769 71,303 A transformed and innovative economy 97 142 31,864 30,163 (31,767) (30,021) – – 2,336 2,035 Housing for all – – 2,774 2,451 (2,774) (2,451) – – – – General purpose income 2 393,245 374,197 – – 393,245 374,197 5,164 6,484 – – Total functions and activities 909,748 894,576 776,286 746,656 133,462 147,920 126,983 134,347 16,907,270 15,377,909 (1) Grants & Contributions are also included within Income totals shown above (2) Includes: Rates & Annual Charges (incl. Ex-Gratia), Untied General Purpose Grants & Unrestricted Interest & Investment Income Council of the City of Sydney Notes to the Financial Statements for the year ended 30 June 2025 B Financial Performance B1 Functions or activities B1-1 Income, expenses and assets - by function/activity Page 16`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'b'.repeat(64), bytes: 2_285_656 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 16),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: CityOfSydneyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial statements 2024/25',
    url: 'https://www.cityofsydney.nsw.gov.au/-/media/corporate/files/publications/research-and-reports/annual-reports/city-of-sydney-financial-statements-2024-2025.pdf?download=true',
    fiscal_year: CITY_OF_SYDNEY_GPFS_FISCAL_YEAR,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/city-of-sydney-gpfs/city-of-sydney-financial-statements-2024-25.pdf',
    sha256: 'b52e7a1ecdde5bea6937f2d3040e04ed340a6db8cceb959d51c73e84504f623b',
    bytes: 2_285_656,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: CITY_OF_SYDNEY_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseCityOfSydneyGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('City of Sydney GPFS source discovery', () => {
  it('discovers the FY2024-25 statements from the annual-report page, never a hard-coded PDF URL', () => {
    const html = `
      <a href="/x/financial-statements-2024-2025.pdf?download=true">Financial statements 2024/25<span>(PDF 2.18 MB)</span></a>
      <a href="/x/financial-statements-2023-24.pdf?download=true">Financial statements 2023/24</a>
      <a href="/x/annual-report-2024-25.pdf?download=true">Annual report 2024/25</a>
    `;
    const links = parseCityOfSydneyGpfsReportLinks(html);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.some((link) => /annual report/i.test(link.title))).toBe(false);
    const selected = selectCityOfSydneyGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(
      'https://www.cityofsydney.nsw.gov.au/x/financial-statements-2024-2025.pdf?download=true',
    );
    expect(fiscalYearFromSydneyGpfsLink('Financial statements 2024/25')).toBe('2024-25');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseCityOfSydneyGpfsReportLinks(
      '<a href="/x.pdf">Financial statements 2023/24</a>',
    );
    expect(() => selectCityOfSydneyGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('City of Sydney GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectCityOfSydneyGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectCityOfSydneyGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.replace("$ '000", '');
    const parsed = parseCityOfSydneyGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('City of Sydney GPFS exact reconciliation', () => {
  it('reads the minimum lines and reconciles exactly to the printed totals', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(18);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(909_748);
    expect(reconciliation.total_expenses).toBe(776_286);
    expect(reconciliation.employee_expenses).toBe(306_623);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(130_214);
    expect(reconciliation.government_grants_operating).toBe(15_652);
    expect(reconciliation.government_grants_capital).toBe(111_331);
    expect(reconciliation.net_result).toBe(133_462);
    expect(reconciliation.net_result_before_capital_grants).toBe(22_131);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(646_072);
    expect(reconciliation.face_expense_bridge).toBe(776_286);
    expect(reconciliation.functions_total_income).toBe(909_748);
    expect(reconciliation.functions_total_expenses).toBe(776_286);
    expect(reconciliation.functions_operating_result).toBe(133_462);
    expect(reconciliation.functions_grants_and_contributions).toBe(126_983);
    expect(reconciliation.comprehensive_income_net_result).toBe(133_462);
    expect(reconciliation.revenue_components_sum).toBe(909_748);
    expect(reconciliation.expense_components_sum).toBe(646_072);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(90_974_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(77_628_600_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(30_662_300_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      13_021_400_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_565_200_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(11_133_100_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(13_346_200_000);
    expect(recordByLine(records, 'net_result_before_capital_grants').amount_cents).toBe(
      2_213_100_000,
    );
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: CITY_OF_SYDNEY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'City of Sydney',
        source_dataset: 'City of Sydney GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^city-of-sydney-gpfs:/);
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

    const totalExpenses = recordByLine(records, 'total_expenses');
    const expenseComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses',
    );
    expect(expenseComponents).toHaveLength(2);
    expect(expenseComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalExpenses.amount_cents,
    );

    const expensesExDepreciation = recordByLine(records, 'total_expenses_excluding_depreciation');
    const natureComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses_excluding_depreciation',
    );
    expect(natureComponents).toHaveLength(5);
    expect(natureComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      expensesExDepreciation.amount_cents,
    );

    // Every output row is agency detail, so neither the API nor an area panel can
    // add it to any other council or state row.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace(
      '776,286 746,656 133,462 147,920',
      '776,287 746,656 133,462 147,920',
    );
    const parsed = parseCityOfSydneyGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 133,462',
      'from Income Statement 133,463',
    );
    const parsed = parseCityOfSydneyGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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

  it('derives stable, line-specific natural keys', () => {
    const url = CONTEXT.document.url;
    const revenue = cityOfSydneyGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = cityOfSydneyGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^city-of-sydney-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(cityOfSydneyGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(cityOfSydneyGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_sydneygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CITY_OF_SYDNEY_GPFS_ID,
    name: CITY_OF_SYDNEY_GPFS_NAME,
    publisher: CITY_OF_SYDNEY_GPFS_PUBLISHER,
    source_url: CITY_OF_SYDNEY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CITY_OF_SYDNEY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'city-of-sydney-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('City of Sydney GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: CITY_OF_SYDNEY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 123_456,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'dubbo-council-gpfs',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-gpfs-1',
        project_name: 'Existing Dubbo GPFS row',
        delivery_entity: 'Dubbo Regional Council',
      },
      {
        // A data.nsw LGA-tagged *state* row that happens to share the place
        // label. It must never be summed with the City of Sydney council rows.
        amount_cents: 654_321,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example.csv',
        verified: false,
        natural_key: 'existing-data-nsw-lga-row',
        project_name: 'Existing LGA-tagged state row',
        delivery_entity: 'City of Sydney',
        location: { lga_name: 'SYDNEY' },
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
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: CITY_OF_SYDNEY_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);
    // The LGA-tagged state row still exists once and is not turned into a
    // City of Sydney council row.
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);

    const existing = await MeasureModel.find({
      source_id: { $in: ['dubbo-council-gpfs', 'data-nsw-ckan'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.natural_key)).toEqual([
      'existing-data-nsw-lga-row',
      'existing-dubbo-gpfs-1',
    ]);
    expect(existing.map((row) => row.amount_cents)).toEqual([654_321, 123_456]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: CITY_OF_SYDNEY_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    expect(
      await MeasureModel.countDocuments({
        source_id: CITY_OF_SYDNEY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CITY_OF_SYDNEY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CITY_OF_SYDNEY_GPFS_ID,
        delivery_entity: { $ne: 'City of Sydney' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: CITY_OF_SYDNEY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
