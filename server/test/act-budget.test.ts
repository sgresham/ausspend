import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  ACT_BUDGET_DATASET,
  ACT_BUDGET_DATASET_ID,
  ACT_BUDGET_ID,
  ACT_BUDGET_MIN_ROWS,
  ACT_BUDGET_UNIT,
  actBudgetNaturalKey,
  actThousandsToCents,
  assertActBudgetPremise,
  createActBudgetConnector,
  detectActBudgetUnit,
  fetchActBudgetRows,
  parseActBudgetRows,
  type ActBudgetRow,
  type ActSocrataMetadata,
} from '../src/connectors/act-budget.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_act`;

const YEARS = ['2021-22', '2022-23', '2023-24', '2024-25', '2025-26'] as const;
const YEAR_FIELDS = [
  '_2021_2022_budgeted_financing',
  '_2022_2023_budgeted_financing',
  '_2023_2024_budgeted_financing',
  '_2024_2025_budgeted_financing',
  '_2025_2026_budgeted_financing',
] as const;

function metadata(): ActSocrataMetadata {
  return {
    id: ACT_BUDGET_DATASET_ID,
    name: ACT_BUDGET_DATASET,
    attribution: 'ACT Government',
    license: 'Creative Commons Attribution 3.0 Australia',
    columns: [
      { name: 'Project Name', fieldName: 'project_name', dataTypeName: 'text' },
      { name: 'Agency', fieldName: 'directorate', dataTypeName: 'text' },
      {
        name: 'Project Classification',
        fieldName: 'project_classification',
        dataTypeName: 'text',
      },
      { name: 'Project Type', fieldName: 'project_type', dataTypeName: 'text' },
      {
        name: 'Wellbeing Domain/ Government Priority',
        fieldName: 'wellbeing_domain_government',
        dataTypeName: 'text',
      },
      ...YEARS.map((_, index) => ({
        name: `${YEARS[index]!.replace('-', '-20')} Budgeted Financing ($'000)`,
        fieldName: YEAR_FIELDS[index]!,
        dataTypeName: 'number',
      })),
      {
        name: "Total Budgeted Financing ($'000)",
        fieldName: 'total_budgeted_financing',
        dataTypeName: 'number',
      },
    ],
  };
}

function rows(): ActBudgetRow[] {
  return Array.from({ length: 12 }, (_, index) => {
    const values = [100 + index, 200 + index, 300 + index, 400 + index, 500 + index];
    return {
      project_name: `Project ${index + 1}`,
      directorate: `Directorate ${index % 3}`,
      project_classification: index % 2 === 0 ? 'New Works' : 'Works-in-progress',
      project_type: 'Urban Infrastructure',
      wellbeing_domain_government: 'Health',
      region: 'Whole of Canberra',
      ...Object.fromEntries(YEAR_FIELDS.map((field, year) => [field, values[year]])),
      total_budgeted_financing: values.reduce((sum, value) => sum + value, 0),
    };
  });
}

describe('ACT budget Socrata parsing', () => {
  const parsed = parseActBudgetRows(rows(), metadata());

  it('emits one budget row per project x fiscal year with explicit $000 unit', () => {
    expect(parsed.records).toHaveLength(12 * YEARS.length);
    expect(parsed.year_columns.map((year) => year.fiscal_year)).toEqual([...YEARS]);
    expect(parsed.unit).toBe(ACT_BUDGET_UNIT);
    expect(parsed.reconciliation.checked).toBe(12);
    expect(parsed.reconciliation.mismatched).toEqual([]);
    for (const record of parsed.records) {
      expect(record.source_id).toBe(ACT_BUDGET_ID);
      expect(record.measure_type).toBe('budget');
      expect(record.jurisdiction_level).toBe('territory');
      expect(record.jurisdiction).toBe('ACT');
      expect(record.location?.state).toBe('ACT');
      expect(record.location?.lga_name).toBeUndefined();
      expect(record.aggregation_role).toBe('additive');
      expect(record.act_unit).toBe(ACT_BUDGET_UNIT);
      expect(record.act_dataset_id).toBe(ACT_BUDGET_DATASET_ID);
      expect(record.project_name).toBeTruthy();
      expect(record.delivery_entity).toBeTruthy();
    }
    expect(() => assertActBudgetPremise(parsed)).not.toThrow();
    expect(parsed.records.length).toBeGreaterThanOrEqual(ACT_BUDGET_MIN_ROWS);
  });

  it('detects the unit from published column names and rejects ambiguity', () => {
    expect(detectActBudgetUnit(metadata())).toBe(ACT_BUDGET_UNIT);
    const dollars = metadata();
    dollars.columns = dollars.columns.map((column) => ({
      ...column,
      name: column.name.replace("($'000)", '($)'),
    }));
    expect(detectActBudgetUnit(dollars)).toBe('AUD');
    const ambiguous = metadata();
    ambiguous.columns = ambiguous.columns.map((column) => ({
      ...column,
      name: column.name.replace("($'000)", ''),
    }));
    expect(() => detectActBudgetUnit(ambiguous)).toThrow(/ambiguous/);
  });

  it('converts thousands to cents and preserves a published zero', () => {
    expect(actThousandsToCents(1)).toBe(100_000);
    expect(actThousandsToCents(0.5)).toBe(50_000);
    const zeroRows = rows();
    zeroRows[0]![YEAR_FIELDS[0]!] = 0;
    zeroRows[0]!.total_budgeted_financing = Number(zeroRows[0]!.total_budgeted_financing) - 100;
    const zeroParsed = parseActBudgetRows(zeroRows, metadata());
    const zero = zeroParsed.records.find(
      (record) => record.project_name === 'Project 1' && record.fiscal_year === '2021-22',
    );
    expect(zero?.amount_cents).toBe(0);
  });

  it('reports a project whose year components do not equal the printed total', () => {
    const bad = rows();
    bad[0]!.total_budgeted_financing = Number(bad[0]!.total_budgeted_financing) + 1_000;
    const badParsed = parseActBudgetRows(bad, metadata());
    expect(badParsed.reconciliation.mismatched).toHaveLength(1);
    expect(() => assertActBudgetPremise(badParsed)).toThrow(/do not reconcile/);
  });

  it('uses stable natural keys including project, directorate and year', () => {
    const key = actBudgetNaturalKey({
      dataset_id: ACT_BUDGET_DATASET_ID,
      project_name: 'Project 1',
      directorate: 'Directorate 0',
      fiscal_year: '2021-22',
    });
    expect(key).toBe(
      actBudgetNaturalKey({
        dataset_id: ACT_BUDGET_DATASET_ID,
        project_name: 'Project 1',
        directorate: 'Directorate 0',
        fiscal_year: '2021-22',
      }),
    );
    expect(key).not.toBe(
      actBudgetNaturalKey({
        dataset_id: ACT_BUDGET_DATASET_ID,
        project_name: 'Project 1',
        directorate: 'Directorate 0',
        fiscal_year: '2022-23',
      }),
    );
    expect(key.startsWith(`${ACT_BUDGET_ID}:`)).toBe(true);
  });

  it('pages the Socrata resource API with $limit/$offset until a short page', async () => {
    const all = Array.from({ length: 60 }, (_, index) => ({
      ...rows()[index % 12]!,
      project_name: `Project ${index}`,
    }));
    const seen: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      seen.push(url.toString());
      const limit = Number(url.searchParams.get('$limit'));
      const offset = Number(url.searchParams.get('$offset'));
      return new Response(JSON.stringify(all.slice(offset, offset + limit)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    const fetched = await fetchActBudgetRows(fetchImpl, { pageSize: 25 });
    expect(fetched.rows).toHaveLength(all.length);
    expect(fetched.pages).toBe(3);
    expect(decodeURIComponent(seen[0]!)).toContain('$limit=25');
    expect(decodeURIComponent(seen[0]!)).toContain('$offset=0');
    expect(decodeURIComponent(seen[1]!)).toContain('$offset=25');
  });
});

describe('ACT budget DB ingestion', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'ausspend-act-'));
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('runs twice without duplicating ACT rows and preserves an unrelated source', async () => {
    const other: SpendingRecord = {
      amount_cents: 1_000,
      measure_type: 'actual',
      fiscal_year: '2021-22',
      source_id: 'unrelated-source',
      source_url: 'https://example.gov.au/unrelated',
      verified: true,
      natural_key: 'unrelated-source:act',
      description: 'Unrelated fixture row',
    };
    await MeasureModel.create(other);

    const connector = createActBudgetConnector({
      rows: rows(),
      metadata: metadata(),
      archiveRoot: tempDir,
    });
    await runIngestion({ connectors: [connector] });
    const afterFirst = await MeasureModel.countDocuments({ source_id: ACT_BUDGET_ID });
    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: ACT_BUDGET_ID })).toBe(afterFirst);
    expect(afterFirst).toBe(12 * YEARS.length);
    expect(await MeasureModel.countDocuments({ source_id: 'unrelated-source' })).toBe(1);
    const source = await DataSourceModel.findOne({ source_id: ACT_BUDGET_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(afterFirst);
    expect(source?.fetch_strategy).toBe('direct');
  });
});
