import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  QLD_LG_ID,
  QLD_LG_ROAD_DATASET,
  QLD_LG_UNIT,
  QLD_LG_UNIT_TO_CENTS,
  createQldLocalGovernmentConnector,
  discoverQldLocalGovernment,
  parseQldLocalGovernmentCsv,
  parseQldLocalGovernmentRoadDataCsv,
  qldLgNaturalKey,
  qldLgThousandsToCents,
  selectFinancialInputsResource,
  selectRoadDataResource,
  type QldCkanPackage,
} from '../src/connectors/qld-local-government.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_qldlg`;

const HEADER = [
  'Local Government',
  'Financial Year',
  "Net rates and utility charges - $'000",
  "Total operating expenses before interest (excl unfunded depreciation) - $'000",
  "Employee expenses - $'000",
  "Depreciation and amortisation expense - $'000",
  "Total Interest paid (borrowing costs) to QTC and other financial institutions - $'000",
  "Total operating expenses before interest * - from 2013/14 $'000",
].join(',');

const CSV = `${HEADER}
Alpha Shire Council,2010_11,1000,5000,1000,500,200,
Beta Shire Council,2010_11,800,4000,900,400,100,
Alpha Shire Council,2013_14,1200,,1100,600,250,6000
Beta Shire Council,2015_16,900,,800,350,50,4500
Bad Year Council,not_a_year,100,,50,40,10,200
,2010_11,100,,10,10,10,100
`;

const ROAD_HEADER = [
  'Council Name',
  'Year',
  'Linear kilometres of council-managed Road - RURAL - TOTAL',
  "Capital Renewal Expenditure on EXISTING roads (excl depn) - $'000",
  "Capital Upgrade Expenditure on EXISTING roads (excl depn) - $'000",
  "Capital Expansion Expenditure on NEW roads (excl depn) - $'000",
  "Total Capital Expenditure on roads (excl depn) - $'000",
  "Total Maintenance Expenditure on roads (excl depn) - $'000",
  "Expenditure on EXISTING bridges and major culverts - $'000",
  "Capital expenditure on NEW bridges and major culverts - $'000",
  "Total Expenditure - Bridges and Culverts - $'000",
  "Depreciation expense for roads - $'000",
  "Total expenditure - roads, bridges, major culverts - $'000",
]
  .map((field) => `"${field}"`)
  .join(',');

const ROAD_CSV = `${ROAD_HEADER}
Alpha Shire Council,2010_11,999,100,50,25,175,200,30,20,50,10,425
Beta Shire Council,2011_12,888,110,60,30,200,220,40,25,65,12,477
`;

function qgipGuard(): SpendingRecord {
  return {
    amount_cents: 1_000,
    measure_type: 'grant_award',
    fiscal_year: '2024-25',
    source_id: 'qld-qgip',
    source_url: 'https://example.gov.au/qgip',
    verified: true,
    natural_key: 'qld-qgip:guard',
    project_name: 'QGIP guard row',
  };
}

describe('QLD local-government CKAN discovery', () => {
  const pkg: QldCkanPackage = {
    name: 'queensland-local-government-comparative-information-report',
    title: 'Queensland local government comparative information report',
    resources: [
      {
        name: 'Financial Inputs',
        format: 'CSV',
        url: 'https://example/financial-inputs.csv',
      },
      { name: 'Personnel data', format: 'CSV', url: 'https://example/personnel.csv' },
      { name: 'Road Data', format: 'CSV', url: 'https://example/road-data.csv' },
    ],
  };

  it('selects the Financial Inputs CSV, not another resource', () => {
    expect(selectFinancialInputsResource(pkg).url).toBe('https://example/financial-inputs.csv');
  });

  it('selects the Road Data CSV separately', () => {
    expect(selectRoadDataResource(pkg).url).toBe('https://example/road-data.csv');
    expect(() =>
      selectRoadDataResource({
        ...pkg,
        resources: [{ name: 'Financial Inputs', format: 'CSV', url: 'x' }],
      }),
    ).toThrow(/no Road Data CSV/);
  });

  it('rejects a package without a Financial Inputs CSV', () => {
    expect(() =>
      selectFinancialInputsResource({
        ...pkg,
        resources: [{ name: 'Personnel data', format: 'CSV', url: 'x' }],
      }),
    ).toThrow(/no Financial Inputs CSV/);
  });

  it('discovers the resource through package_show', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ result: pkg }),
    })) as unknown as typeof fetch;
    const discovered = await discoverQldLocalGovernment(fetchImpl);
    expect(discovered.pkg.name).toBe(pkg.name);
    expect(discovered.resource.name).toBe('Financial Inputs');
    expect(discovered.roadData.name).toBe('Road Data');
  });
});

describe('QLD local-government Financial Inputs parsing', () => {
  const parsed = parseQldLocalGovernmentCsv(CSV);

  it('emits council × year × measure rows and skips invalid years/blank councils', () => {
    expect(parsed.records).toHaveLength(20);
    expect(parsed.councils).toBe(2);
    expect(parsed.years).toBe(3);
    expect(parsed.skipped.map((skip) => skip.reason).join(' | ')).toMatch(/invalid Financial Year/);
    expect(parsed.skipped.map((skip) => skip.reason).join(' | ')).toMatch(
      /missing Local Government/,
    );
  });

  it('maps council-level provenance, $’000 unit and non-additive agency detail', () => {
    for (const record of parsed.records) {
      expect(record.source_id).toBe(QLD_LG_ID);
      expect(record.jurisdiction_level).toBe('local');
      expect(record.jurisdiction).toBe('QLD');
      expect(record.location?.state).toBe('QLD');
      expect(record.location?.lga_name).toBeTruthy();
      expect(record.delivery_entity).toBe(record.project_name);
      expect(record.measure_type).toBe('actual');
      expect(record.qld_lg_unit).toBe(QLD_LG_UNIT);
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
    }
  });

  it('labels total and component measures without adding components to the total', () => {
    const total = parsed.records.find(
      (record) => record.qld_lg_measure === 'total_operating_expenses',
    );
    const employee = parsed.records.find((record) => record.qld_lg_measure === 'employee_expenses');
    expect(total?.qld_lg_component_of).toBeUndefined();
    expect(employee?.qld_lg_component_of).toBe('total_operating_expenses');
    expect(employee?.amount_cents).toBe(1000 * QLD_LG_UNIT_TO_CENTS);
  });

  it('never emits a cross-council total row', () => {
    expect(
      parsed.records.every((record) => record.project_name && record.project_name !== 'Total'),
    ).toBe(true);
    expect(
      parsed.records.some((record) =>
        /all councils|total councils/i.test(record.project_name ?? ''),
      ),
    ).toBe(false);
  });

  it('converts $’000 to integer cents', () => {
    expect(qldLgThousandsToCents(1)).toBe(100_000);
    expect(qldLgThousandsToCents(5000)).toBe(500_000_000);
  });

  it('is idempotent on natural keys', () => {
    const again = parseQldLocalGovernmentCsv(CSV);
    expect(again.records.map((record) => record.natural_key)).toEqual(
      parsed.records.map((record) => record.natural_key),
    );
    expect(
      qldLgNaturalKey({
        council: 'Alpha Shire Council',
        fiscal_year: '2010-11',
        measure: 'employee_expenses',
      }),
    ).toBe(
      qldLgNaturalKey({
        council: 'Alpha Shire Council',
        fiscal_year: '2010-11',
        measure: 'employee_expenses',
      }),
    );
  });

  it('fails when a component exceeds the printed council total', () => {
    const bad = CSV.replace(
      'Beta Shire Council,2015_16,900,,800,350,50,4500',
      'Beta Shire Council,2015_16,900,,800,350,50,1000',
    );
    expect(() => parseQldLocalGovernmentCsv(bad)).toThrow(/reconciliation failed/);
  });
});

describe('QLD local-government Road Data financial measures', () => {
  const parsed = parseQldLocalGovernmentRoadDataCsv(ROAD_CSV);

  it('ingests only printed $’000 expenditure rows, never road kilometres or counts', () => {
    expect(parsed.records).toHaveLength(20);
    expect(parsed.councils).toBe(2);
    expect(parsed.years).toBe(2);
    const renewal = parsed.records.find(
      (record) => record.category === 'road_capital_renewal_expenditure',
    )!;
    expect(renewal.source_dataset).toBe(QLD_LG_ROAD_DATASET);
    expect(renewal.qld_lg_unit).toBe(QLD_LG_UNIT);
    expect(renewal.qld_lg_component_of).toBe('road_total_capital_expenditure');
    expect(renewal.amount_cents).toBe(100 * QLD_LG_UNIT_TO_CENTS);
    expect(renewal.location).toMatchObject({ state: 'QLD', lga_name: 'Alpha Shire Council' });
    expect(parsed.records.some((record) => record.description.includes('Linear kilometres'))).toBe(
      false,
    );
    expect(parsed.records.every((record) => record.measure_type === 'actual')).toBe(true);
    expect(parsed.records.every((record) => record.aggregation_role === 'agency_detail')).toBe(
      true,
    );
  });

  it('skips blank or invalid road rows without inventing a value', () => {
    const sparse = parseQldLocalGovernmentRoadDataCsv(
      `${ROAD_HEADER}
,2010_11,1,100,50,25,175,200,30,20,50,10,425
Alpha Shire Council,not_a_year,1,100,50,25,175,200,30,20,50,10,425
`,
    );
    expect(sparse.records).toHaveLength(0);
    expect(sparse.skipped.map((skip) => skip.reason).join(' | ')).toMatch(/missing Council Name/);
    expect(sparse.skipped.map((skip) => skip.reason).join(' | ')).toMatch(/invalid Year/);
  });
});

describe('QLD local-government ingestion is idempotent and separate from QGIP', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('runs twice without duplication and preserves an unrelated QGIP row', async () => {
    await MeasureModel.create(qgipGuard());
    const connector = createQldLocalGovernmentConnector({ csvText: CSV });
    await runIngestion({ connectors: [connector] });
    await runIngestion({ connectors: [connector] });

    expect(await MeasureModel.countDocuments({ source_id: QLD_LG_ID })).toBe(20);
    expect(await MeasureModel.countDocuments({ source_id: 'qld-qgip' })).toBe(1);
    const source = await DataSourceModel.findOne({ source_id: QLD_LG_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(20);
    expect(source?.fetch_strategy).toBe('direct');
  });

  it('labels every row with a QLD-local measure and never a QGIP measure', async () => {
    const local = await MeasureModel.find({ source_id: QLD_LG_ID }).lean();
    expect(local.every((row) => row.category !== undefined)).toBe(true);
    expect(local.every((row) => row.measure_type === 'actual')).toBe(true);
    expect(local.every((row) => row.aggregation_role === 'agency_detail')).toBe(true);
    const qgip = await MeasureModel.findOne({ source_id: 'qld-qgip' }).lean();
    expect(qgip?.measure_type).toBe('grant_award');
    expect(qgip?.qld_lg_measure).toBeUndefined();
  });

  it('adds Road Data rows idempotently without changing financial-input rows', async () => {
    await MeasureModel.deleteMany({ source_id: QLD_LG_ID });
    const connector = createQldLocalGovernmentConnector({
      financialInputsCsvText: CSV,
      roadDataCsvText: ROAD_CSV,
    });
    await runIngestion({ connectors: [connector] });
    await runIngestion({ connectors: [connector] });

    expect(await MeasureModel.countDocuments({ source_id: QLD_LG_ID })).toBe(40);
    expect(
      await MeasureModel.countDocuments({
        source_id: QLD_LG_ID,
        source_dataset: QLD_LG_ROAD_DATASET,
      }),
    ).toBe(20);
    expect(await MeasureModel.countDocuments({ source_id: 'qld-qgip' })).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: QLD_LG_ID,
        source_dataset: QLD_LG_ROAD_DATASET,
      }),
    ).toBe(20);
    const source = await DataSourceModel.findOne({ source_id: QLD_LG_ID }).lean();
    expect(source?.records_ingested).toBe(40);
  });
});
