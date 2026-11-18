import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WOOLLAHRA_GPFS_FISCAL_YEAR,
  WOOLLAHRA_GPFS_ID,
  WOOLLAHRA_GPFS_SOURCE_DATASET,
  createWoollahraGpfsConnector,
  parseWoollahraGpfsExtraction,
  type WoollahraParseContext,
} from '../src/connectors/woollahra-gpfs/index.js';
import {
  GOLDEN_DIGEST,
  WOOLLAHRA_CONTEXT,
  WOOLLAHRA_GPFS_ROW_COUNT,
  WOOLLAHRA_PDF_SHA256,
  goldenDigest,
  goldenRecords,
  woollahraExtraction,
} from '../src/connectors/woollahra-gpfs/fixture.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_woollahra`;

const CONTEXT: WoollahraParseContext = WOOLLAHRA_CONTEXT;

function parsedFixture() {
  return parseWoollahraGpfsExtraction(woollahraExtraction(), CONTEXT);
}

function record(records: SpendingRecord[], line: string): SpendingRecord {
  const found = records.find((entry) => entry.gpfs_line_item === line);
  if (!found) throw new Error(`missing ${line}`);
  return found;
}

describe('Woollahra Municipal Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and rejects a missing printed unit", () => {
    const ambiguous = parseWoollahraGpfsExtraction(
      woollahraExtraction({
        income: woollahraExtraction().pages[0]!.text.replace(/\$ '000/g, 'amount'),
        functions: woollahraExtraction().pages[2]!.text.replace(/\$ '000/g, 'amount'),
      }),
      CONTEXT,
    );
    expect(ambiguous.records).toEqual([]);
    expect(ambiguous.reconciliation).toBeNull();
    expect(ambiguous.rejections[0]!.reason).toMatch(/printed unit is ambiguous/);
  });
});

describe('Woollahra Municipal Council GPFS printed totals', () => {
  it('extracts the printed revenue/expense/result totals and B1-1 function expenses', () => {
    const parsed = parsedFixture();
    expect(parsed.reconciliation).not.toBeNull();
    expect(parsed.records).toHaveLength(WOOLLAHRA_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(29);

    expect(record(parsed.records, 'total_revenue').amount_cents).toBe(13_959_200_000);
    expect(record(parsed.records, 'total_expenses').amount_cents).toBe(12_962_900_000);
    expect(record(parsed.records, 'employee_expenses').amount_cents).toBe(5_296_800_000);
    expect(record(parsed.records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_641_300_000,
    );
    expect(record(parsed.records, 'government_grants_operating').amount_cents).toBe(461_500_000);
    expect(record(parsed.records, 'government_grants_capital').amount_cents).toBe(861_200_000);
    expect(record(parsed.records, 'net_result').amount_cents).toBe(996_300_000);
    expect(record(parsed.records, 'function_connected_harmonious_community').amount_cents).toBe(
      44_900_000,
    );
    expect(record(parsed.records, 'function_well_managed_council').amount_cents).toBe(
      3_845_700_000,
    );

    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(139_592);
    expect(reconciliation.total_expenses).toBe(129_629);
    expect(reconciliation.employee_expenses).toBe(52_968);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(16_413);
    expect(reconciliation.government_grants_operating).toBe(4_615);
    expect(reconciliation.government_grants_capital).toBe(8_612);
    expect(reconciliation.net_result).toBe(9_963);
    expect(reconciliation.revenue_components_sum).toBe(139_592);
    expect(reconciliation.expense_components_sum).toBe(113_216);
    expect(reconciliation.expense_bridge).toBe(129_629);
    expect(reconciliation.functions_total_income).toBe(139_592);
    expect(reconciliation.functions_total_expenses).toBe(129_629);
    expect(reconciliation.functions_operating_result).toBe(9_963);
    expect(reconciliation.comprehensive_income_net_result).toBe(9_963);
    expect(reconciliation.function_expenses_sum).toBe(12_962_900_000);
    expect(reconciliation.function_expenses_sum).toBe(
      record(parsed.records, 'total_expenses').amount_cents,
    );
  });

  it('rejects a non-reconciling printed B1-1 total and ingests no rows', () => {
    const badTotal = parseWoollahraGpfsExtraction(
      woollahraExtraction({
        functions: woollahraExtraction().pages[2]!.text.replace('129,629', '129,000'),
      }),
      CONTEXT,
    );
    expect(badTotal.records).toEqual([]);
    expect(badTotal.reconciliation).toBeNull();
    expect(badTotal.rejections.length).toBeGreaterThan(0);
    expect(badTotal.rejections[0]!.reason).toMatch(/GPFS reconciliation failed/);
  });
});

describe('Woollahra Municipal Council GPFS provenance and no-sum guard', () => {
  it('maps every row to the council-only provenance and keeps rows non-additive', () => {
    const { records } = parsedFixture();
    for (const row of records) {
      expect(row.source_id).toBe(WOOLLAHRA_GPFS_ID);
      expect(row.measure_type).toBe('actual');
      expect(row.fiscal_year).toBe(WOOLLAHRA_GPFS_FISCAL_YEAR);
      expect(row.jurisdiction_level).toBe('local');
      expect(row.jurisdiction).toBe('NSW');
      expect(row.delivery_entity).toBe('Woollahra Municipal Council');
      expect(row.source_dataset).toBe(WOOLLAHRA_GPFS_SOURCE_DATASET);
      expect(row.data_quality_flag).toBe('provisional/local_government');
      expect(row.aggregation_role).toBe('agency_detail');
      expect(row.verified).toBe(false);
      expect(row.natural_key).toMatch(/^woollahra-gpfs:[a-f0-9]{40}$/);
      expect(row.notes).toContain('never summed with any other council or state rows');
      expect(row.notes).toContain(WOOLLAHRA_PDF_SHA256);
      expect(row.notes).toContain('no region/LGA allocation');
    }
    expect(record(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(record(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(record(records, 'total_revenue').potential_double_count).toBeUndefined();
    // The printed rows form two separate cuts, never one additive total.
    const allRows = records.reduce((sum, row) => sum + row.amount_cents, 0);
    expect(allRows).not.toBe(record(records, 'total_expenses').amount_cents);
  });

  it('uses stable unique natural keys and an unchanged golden digest', () => {
    const first = parsedFixture().records;
    const second = parsedFixture().records;
    expect(second.map((row) => row.natural_key)).toEqual(first.map((row) => row.natural_key));
    expect(new Set(first.map((row) => row.natural_key)).size).toBe(first.length);
    expect(goldenDigest(first)).toBe(GOLDEN_DIGEST);
    expect(goldenRecords()).toHaveLength(WOOLLAHRA_GPFS_ROW_COUNT);
  });
});

describe('Woollahra Municipal Council GPFS DB ingestion', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('runs twice without duplicating and preserves existing source counts', async () => {
    const existing: SpendingRecord[] = [
      {
        amount_cents: 1_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'unrelated-source',
        source_url: 'https://example.gov.au/unrelated',
        verified: true,
        natural_key: 'unrelated-source:woollahra-1',
        description: 'Unrelated fixture one',
      },
      {
        amount_cents: 2_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'unrelated-source',
        source_url: 'https://example.gov.au/unrelated',
        verified: true,
        natural_key: 'unrelated-source:woollahra-2',
        description: 'Unrelated fixture two',
      },
      {
        amount_cents: 3_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'hunters-hill-gpfs',
        source_url: 'https://www.huntershill.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'hunters-hill-gpfs:existing-row',
        description: 'Pre-existing other council row',
      },
    ];
    await MeasureModel.create(existing);
    const unrelatedBefore = await MeasureModel.countDocuments({ source_id: 'unrelated-source' });
    const otherCouncilBefore = await MeasureModel.countDocuments({
      source_id: 'hunters-hill-gpfs',
    });
    expect(unrelatedBefore).toBe(2);
    expect(otherCouncilBefore).toBe(1);

    const connector = createWoollahraGpfsConnector({
      extraction: woollahraExtraction(),
      document: CONTEXT.document,
      archive: CONTEXT.archive,
    });
    await runIngestion({ connectors: [connector], now: () => new Date('2026-11-18T00:00:00Z') });
    const count = await MeasureModel.countDocuments({ source_id: WOOLLAHRA_GPFS_ID });
    expect(count).toBe(WOOLLAHRA_GPFS_ROW_COUNT);

    await runIngestion({ connectors: [connector], now: () => new Date('2026-11-18T00:00:01Z') });
    expect(await MeasureModel.countDocuments({ source_id: WOOLLAHRA_GPFS_ID })).toBe(count);
    expect(await MeasureModel.countDocuments({ source_id: 'unrelated-source' })).toBe(
      unrelatedBefore,
    );
    expect(await MeasureModel.countDocuments({ source_id: 'hunters-hill-gpfs' })).toBe(
      otherCouncilBefore,
    );
    expect(await MeasureModel.countDocuments({})).toBe(3 + WOOLLAHRA_GPFS_ROW_COUNT);

    const source = await DataSourceModel.findOne({ source_id: WOOLLAHRA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(WOOLLAHRA_GPFS_ROW_COUNT);
  });

  it('stores every row as non-additive agency detail with no region allocation', async () => {
    if ((await MeasureModel.countDocuments({ source_id: WOOLLAHRA_GPFS_ID })) === 0) {
      const connector = createWoollahraGpfsConnector({
        extraction: woollahraExtraction(),
        document: CONTEXT.document,
        archive: CONTEXT.archive,
      });
      await runIngestion({ connectors: [connector] });
    }
    const rows = await MeasureModel.find({ source_id: WOOLLAHRA_GPFS_ID }).lean();
    expect(rows).toHaveLength(WOOLLAHRA_GPFS_ROW_COUNT);
    for (const row of rows) {
      expect(row.aggregation_role).toBe('agency_detail');
      expect(row.region_id).toBeUndefined();
      expect(row.delivery_entity).toBe('Woollahra Municipal Council');
      expect(row.verified).toBe(false);
    }
  });
});
