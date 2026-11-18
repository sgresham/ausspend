import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WA_MYCOUNCIL_EXPENDITURE_DATASET,
  WA_MYCOUNCIL_FINANCE_DATASET,
  WA_MYCOUNCIL_ID,
  WA_MYCOUNCIL_UNIT,
  WA_MYCOUNCIL_UNIT_TO_CENTS,
  createWaMyCouncilConnector,
  fetchWaMyCouncilRecords,
  financialYearFromMyCouncil,
  parseWaODataMetadata,
  programSlug,
  validateWaODataMetadata,
  waMyCouncilDollarsToCents,
  waMyCouncilNaturalKey,
} from '../src/connectors/wa-mycouncil.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { Connector } from '../src/connectors/types.js';

const METADATA_XML = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices m:DataServiceVersion="1.0" m:MaxDataServiceVersion="3.0" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
    <Schema Namespace="BIMartModel" xmlns="http://schemas.microsoft.com/ado/2009/11/edm">
      <EntityType Name="vw_LG_Expenditure">
        <Key><PropertyRef Name="LGId" /></Key>
        <Property Name="LGId" Type="Edm.Int32" Nullable="false" />
        <Property Name="LGName" Type="Edm.String" Nullable="false" />
        <Property Name="DateId" Type="Edm.Int32" Nullable="false" />
        <Property Name="FinancialYear" Type="Edm.String" Nullable="false" />
        <Property Name="Program" Type="Edm.String" Nullable="false" />
        <Property Name="Expenditure" Type="Edm.Int32" Nullable="false" />
        <Property Name="LGType" Type="Edm.String" Nullable="false" />
      </EntityType>
      <EntityType Name="vw_LG_FinanceActuals">
        <Key><PropertyRef Name="LGId" /><PropertyRef Name="FinancialYear" /></Key>
        <Property Name="LGId" Type="Edm.Int32" Nullable="false" />
        <Property Name="LGName" Type="Edm.String" Nullable="false" />
        <Property Name="FinancialYear" Type="Edm.String" Nullable="false" />
        <Property Name="TotalRevenue" Type="Edm.Decimal" Nullable="false" />
        <Property Name="EmployeeCost" Type="Edm.Decimal" Nullable="false" />
      </EntityType>
      <EntitySet Name="vw_LG_Expenditure" EntityType="BIMartModel.vw_LG_Expenditure" />
      <EntitySet Name="vw_LG_FinanceActuals" EntityType="BIMartModel.vw_LG_FinanceActuals" />
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

const REAL_COUNCILS = [
  'Swan',
  'Wanneroo',
  'Perth',
  'Cockburn',
  'Joondalup',
  'Rockingham',
  'Mandurah',
  'Armadale',
  'Melville',
  'Gosnells',
  'Canning',
  'Karratha',
  'East Pilbara',
  'Fremantle',
  'Busselton',
  'Port Hedland',
  'Kalgoorlie-Boulder',
  'Bayswater',
  'Greater Geraldton',
  'Stirling',
  'Carnamah',
  'Coorow',
  'Murchison',
  'Coolgardie',
  'Albany',
  'Narrogin',
  'Yalgoo',
  'Wiluna',
  'Cambridge',
  'Belmont',
  'Bruce Rock',
  'Brookton',
  'Lake Grace',
  'Augusta Margaret River',
  'Bassendean',
] as const;

const EXPENDITURE_ROWS = REAL_COUNCILS.map((name, index) => ({
  LGId: index + 1,
  LGName: name,
  DateId: 20240701,
  FinancialYear: '2024/2025',
  Program: 'Total Expenditure',
  Expenditure: name === 'Swan' ? 284_214_363 : 1_000_000 + index * 1_000,
  LGType: 'City',
}));

const EXPENDITURE_PROGRAM_ROWS = [
  {
    LGId: 1,
    LGName: 'Swan',
    DateId: 20240701,
    FinancialYear: '2024/2025',
    Program: 'Transport',
    Expenditure: 30_037_432,
    LGType: 'City',
  },
  {
    LGId: 2,
    LGName: 'Wanneroo',
    DateId: 20240701,
    FinancialYear: '2024/2025',
    Program: 'Recreation and Culture',
    Expenditure: 20_000_000,
    LGType: 'City',
  },
];

const FINANCE_ROWS = [
  {
    LGId: 1,
    LGName: 'Swan',
    FinancialYear: '2024/2025',
    TotalRevenue: '250000000.00',
    EmployeeCost: '60000000.00',
  },
  {
    LGId: 2,
    LGName: 'Wanneroo',
    FinancialYear: '2024/2025',
    TotalRevenue: '240000000.00',
    EmployeeCost: '58000000.00',
  },
  {
    LGId: 21,
    LGName: 'Carnamah',
    FinancialYear: '2024/2025',
    TotalRevenue: '0.00',
    EmployeeCost: '0.00',
  },
];

function jsonResponse(value: unknown[]): Response {
  return new Response(JSON.stringify({ value }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function metadataResponse(): Response {
  return new Response(METADATA_XML, {
    status: 200,
    headers: { 'content-type': 'application/xml' },
  });
}

function pagedFetch(calls: string[], pageSizeOverride?: number): typeof fetch {
  return async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('$metadata')) return metadataResponse();
    if (url.includes('FinanceBudget') || url.includes('GrantData')) {
      throw new Error(`unexpected non-actual entity set: ${url}`);
    }
    const parsed = new URL(url);
    const skip = Number(parsed.searchParams.get('$skip') ?? 0);
    const top = Number(parsed.searchParams.get('$top') ?? pageSizeOverride ?? 1000);
    const source = url.includes('vw_LG_Expenditure')
      ? [...EXPENDITURE_ROWS, ...EXPENDITURE_PROGRAM_ROWS]
      : FINANCE_ROWS;
    return jsonResponse(source.slice(skip, skip + top));
  };
}

describe('WA MyCouncil OData metadata', () => {
  it('parses entity sets and required properties', () => {
    const metadata = parseWaODataMetadata(METADATA_XML);
    expect(metadata.entitySets).toEqual(['vw_LG_Expenditure', 'vw_LG_FinanceActuals']);
    expect(metadata.entityTypes.vw_LG_Expenditure).toEqual(
      expect.arrayContaining(['LGId', 'LGName', 'FinancialYear', 'Program', 'Expenditure']),
    );
    expect(() => validateWaODataMetadata(metadata)).not.toThrow();
  });

  it('rejects metadata without the actual entity set or money field', () => {
    const missingSet = METADATA_XML.replace(
      '<EntitySet Name="vw_LG_FinanceActuals"',
      '<EntitySet Name="other"',
    );
    expect(() => validateWaODataMetadata(parseWaODataMetadata(missingSet))).toThrow(
      /no vw_LG_FinanceActuals entity set/,
    );
    const missingField = METADATA_XML.replace('Name="Expenditure"', 'Name="Other"');
    expect(() => validateWaODataMetadata(parseWaODataMetadata(missingField))).toThrow(
      /no Expenditure property/,
    );
  });
});

describe('WA MyCouncil paging and mapping', () => {
  it('pages both actual entity sets and never calls budget or grant sets', async () => {
    const calls: string[] = [];
    const result = await fetchWaMyCouncilRecords({
      fetchImpl: pagedFetch(calls),
      pageSize: 10,
      now: () => new Date('2026-11-18T00:00:00Z'),
    });
    expect(result.expenditureRows).toBe(37);
    expect(result.financeRows).toBe(3);
    expect(result.expenditurePages).toBe(4);
    expect(result.financePages).toBe(1);
    expect(result.councils).toBeGreaterThanOrEqual(30);
    expect(result.years).toEqual(['2024-25']);
    expect(calls.some((url) => url.includes('FinanceBudget') || url.includes('GrantData'))).toBe(
      false,
    );
    expect(calls.some((url) => url.includes('%24top=10') && url.includes('%24skip=30'))).toBe(true);
  });

  it('maps whole dollars to cents, lga names and program/line categories', async () => {
    const result = await fetchWaMyCouncilRecords({
      fetchImpl: pagedFetch([]),
      pageSize: 1000,
      now: () => new Date('2026-11-18T00:00:00Z'),
    });
    const swanTotal = result.records.find(
      (record) =>
        record.project_name === 'Swan' &&
        record.category === 'total_expenditure' &&
        record.source_dataset === WA_MYCOUNCIL_EXPENDITURE_DATASET,
    )!;
    expect(swanTotal.amount_cents).toBe(28_421_436_300);
    expect(swanTotal.location).toMatchObject({ state: 'WA', lga_name: 'Swan' });
    expect(swanTotal.measure_type).toBe('actual');
    expect(swanTotal.jurisdiction_level).toBe('local');
    expect(swanTotal.jurisdiction).toBe('WA');
    expect(swanTotal.delivery_entity).toBe('Swan');
    expect(swanTotal.source_url).toContain('vw_LG_Expenditure');
    expect(swanTotal.notes).toContain('whole AUD');

    const transport = result.records.find(
      (record) => record.project_name === 'Swan' && record.category === 'transport',
    )!;
    expect(transport.amount_cents).toBe(3_003_743_200);
    expect(programSlug('Recreation and Culture')).toBe('recreation_and_culture');

    const finance = result.records.find(
      (record) =>
        record.project_name === 'Swan' &&
        record.source_dataset === WA_MYCOUNCIL_FINANCE_DATASET &&
        record.category === 'total_revenue',
    )!;
    expect(finance.amount_cents).toBe(25_000_000_000);
    expect(
      result.records.some(
        (record) => record.project_name === 'Carnamah' && record.category === 'total_revenue',
      ),
    ).toBe(false);
  });

  it('uses explicit whole-dollar conversion and stable financial years', () => {
    expect(waMyCouncilDollarsToCents(284_214_363)).toBe(28_421_436_300);
    expect(waMyCouncilDollarsToCents(1)).toBe(WA_MYCOUNCIL_UNIT_TO_CENTS);
    expect(financialYearFromMyCouncil('2024/2025')).toBe('2024-25');
    expect(financialYearFromMyCouncil('2024-25')).toBeNull();
    expect(WA_MYCOUNCIL_UNIT).toBe('AUD');
  });

  it('derives stable natural keys including council, year and line', () => {
    const key = waMyCouncilNaturalKey({
      kind: 'expenditure',
      lgId: 119,
      fiscalYear: '2024-25',
      line: 'total_expenditure',
    });
    expect(key).toMatch(/^wa-mycouncil:[a-f0-9]{40}$/);
    expect(key).toBe(
      waMyCouncilNaturalKey({
        kind: 'expenditure',
        lgId: 119,
        fiscalYear: '2024-25',
        line: 'total_expenditure',
      }),
    );
    expect(key).not.toBe(
      waMyCouncilNaturalKey({
        kind: 'expenditure',
        lgId: 119,
        fiscalYear: '2024-25',
        line: 'transport',
      }),
    );
  });

  it('emits no cross-council total and keeps every row council-scoped', async () => {
    const result = await fetchWaMyCouncilRecords({ fetchImpl: pagedFetch([]), pageSize: 1000 });
    expect(result.records.every((record) => record.location?.lga_name)).toBe(true);
    expect(
      result.records.some((record) =>
        /all councils|total councils/i.test(record.project_name ?? ''),
      ),
    ).toBe(false);
    const councilNames = new Set(result.records.map((record) => record.location?.lga_name));
    expect(councilNames.size).toBeGreaterThanOrEqual(30);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_wamc`;

function guardBudget(): SpendingRecord {
  return {
    amount_cents: 1_000,
    measure_type: 'actual',
    fiscal_year: '2024-25',
    source_id: 'wa-budget',
    source_url: 'https://example.wa.gov.au/budget',
    verified: true,
    natural_key: 'wa-budget:guard',
    project_name: 'WA Budget guard row',
  };
}

describe('WA MyCouncil ingestion is idempotent and separate from WA Budget', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('ingests actuals idempotently and never touches WA Budget rows', async () => {
    await MeasureModel.create(guardBudget());
    const connector: Connector = createWaMyCouncilConnector({
      metadataXml: METADATA_XML,
      expenditurePageOverride: [...EXPENDITURE_ROWS, ...EXPENDITURE_PROGRAM_ROWS],
      financePageOverride: FINANCE_ROWS,
    });
    await runIngestion({ connectors: [connector] });
    await runIngestion({ connectors: [connector] });

    expect(await MeasureModel.countDocuments({ source_id: WA_MYCOUNCIL_ID })).toBe(41);
    expect(await MeasureModel.countDocuments({ source_id: 'wa-budget' })).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: WA_MYCOUNCIL_ID,
        source_dataset: /Budget/i,
      }),
    ).toBe(0);
    const source = await DataSourceModel.findOne({ source_id: WA_MYCOUNCIL_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(41);
  });
});
