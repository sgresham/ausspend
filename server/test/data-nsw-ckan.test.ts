import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  detectAmountColumns,
  detectUnitFromHeader,
  detectUnitFromNumberFormat,
  detectUnitFromValues,
  fiscalYearFromColumnHeader,
  mapNswCkanTable,
  nswCkanAmountToCents,
  nswCkanNaturalKey,
  nswCkanRowHash,
  parseAmountValue,
  parseCsvRows,
  prepareTableContext,
  readXlsxTable,
  type NswCkanResourceSpec,
  type NswCkanTableBase,
} from '../src/connectors/index.js';
import type { RawRecord } from '../src/connectors/types.js';

const BUDGET_SPEC: NswCkanResourceSpec = {
  id: 'res-bp2',
  name: 'NSW_BudgetPaper2_201617',
  mode: 'datastore',
  amountColumns: ['Allocation201415', 'Allocation201516', 'Allocation201617'],
  measureType: 'budget',
  measureTypeRationale: 'Budget Paper 2 capital allocation; budgeted, not actual spend.',
  unit: "$'000",
  unitExplicit: false,
  unitEvidence:
    "CKAN metadata does not state a unit; NSW Budget Paper 2 allocations are conventionally $'000.",
  entityColumns: ['AgencyName'],
  lgaColumns: ['LGA'],
  labelColumns: ['ProjectName'],
};

function baseContext(overrides: Partial<NswCkanTableBase> = {}): NswCkanTableBase {
  return {
    packageId: '56f0b52a-1354-4910-b681-509ecd92888e',
    packageName: 'nsw-budget-paper-2',
    datasetTitle: 'NSW Budget Paper 2',
    datasetPage: 'https://data.nsw.gov.au/data/dataset/nsw-budget-paper-2',
    resourceId: '0b1ab94e-10a1-4fa9-b483-1cd72f5df778',
    resourceName: 'NSW_BudgetPaper2_201617',
    resourceFormat: 'CSV',
    resourceUrl:
      'https://data.nsw.gov.au/data/dataset/56f0b52a-1354-4910-b681-509ecd92888e/resource/0b1ab94e-10a1-4fa9-b483-1cd72f5df778/download/nswbudgetpaper2201617.csv',
    sourceDate: '2016-06-21',
    mode: 'datastore',
    measureType: 'budget',
    measureTypeRationale: 'Budget Paper 2 capital allocation; budgeted, not actual spend.',
    labelColumns: ['ProjectName'],
    entityColumns: ['AgencyName'],
    lgaColumns: ['LGA'],
    archive: {
      local_path: '/tmp/ausspend-source-archive/data-nsw-ckan/bp2.json',
      sha256: 'a'.repeat(64),
      bytes: 1234,
    },
    warnings: [],
    ...overrides,
  };
}

const BUDGET_ROWS: RawRecord[] = [
  {
    AgencyName: 'The Legislature',
    AgencyCategory: 'The Legislature',
    ProjectName: 'Lotus Notes/Domino Replacement',
    LGA: 'Sydney',
    Allocation201415: 1810,
    Allocation201516: 3074,
    Allocation201617: '700',
  },
  {
    AgencyName: 'Fire and Rescue NSW',
    AgencyCategory: 'Police and Justice',
    ProjectName: 'Gulgong Land and New Station',
    LGA: '',
    Allocation201415: null,
    Allocation201516: null,
    Allocation201617: 0,
  },
  {
    AgencyName: 'Total',
    AgencyCategory: '',
    ProjectName: '',
    LGA: '',
    Allocation201415: 0,
    Allocation201516: 0,
    Allocation201617: 999,
  },
];

describe('generic tabular mapper — unit detection', () => {
  it("detects explicit $, $'000, $m and $b markers, and never invents one", () => {
    expect(detectUnitFromHeader('Original RAM Funding $')).toBe('$');
    expect(detectUnitFromHeader('Allocation ($000)')).toBe("$'000");
    expect(detectUnitFromHeader("Amount $'000")).toBe("$'000");
    expect(detectUnitFromHeader('Amount ($m)')).toBe('$m');
    expect(detectUnitFromHeader('Amount $b')).toBe('$b');
    expect(detectUnitFromHeader('Invoice Charge (exc GST)')).toBeNull();
    expect(detectUnitFromNumberFormat('"$"#,##0')).toBe('$');
    expect(detectUnitFromNumberFormat('#,##0,')).toBe("$'000");
    expect(detectUnitFromValues(['$329,779'])).toBe('$');
    expect(detectUnitFromValues([89910287])).toBeNull();
  });

  it('converts amounts to integer cents with an explicit multiplier', () => {
    expect(nswCkanAmountToCents('$329,779', '$')).toEqual({ cents: 32_977_900, negative: false });
    expect(nswCkanAmountToCents(1810, "$'000")).toEqual({ cents: 181_000_000, negative: false });
    expect(nswCkanAmountToCents(2.5, '$m')).toEqual({ cents: 250_000_000, negative: false });
    expect(nswCkanAmountToCents('1.25', '$b')).toEqual({
      cents: 125_000_000_000,
      negative: false,
    });
    expect(nswCkanAmountToCents(-1, '$')).toEqual({ cents: null, negative: true });
    expect(nswCkanAmountToCents('n.a.', '$')).toEqual({ cents: null, negative: false });
    expect(parseAmountValue('$1,234')).toBe(1234);
    expect(parseAmountValue('(1,234)')).toBe(-1234);
    expect(parseAmountValue('')).toBeNull();
  });

  it('resolves an explicit $ header and leaves an ambiguous unit provisional', () => {
    const ramRows: RawRecord[] = [
      { School: 'Abbotsford Public School', 'Original RAM Funding $': '$329,779' },
    ];
    const ram = prepareTableContext(
      ['School', 'Original RAM Funding $'],
      ramRows,
      baseContext({
        packageName: 'nsw-education-resource-allocation-model',
        datasetTitle: 'NSW public schools Resource Allocation Model (RAM) funding by school',
        resourceId: '359f1b44-f453-4cc6-961f-840a4b83d1de',
        resourceName: '2026 Resource Allocation Model (RAM) funding table',
        resourceUrl: 'https://data.nsw.gov.au/data/dataset/ram/resource/359f/download/ram.csv',
        measureType: 'budget',
        labelColumns: ['School'],
        entityColumns: ['School'],
        lgaColumns: [],
      }),
      {
        id: '359f1b44-f453-4cc6-961f-840a4b83d1de',
        name: '2026 Resource Allocation Model (RAM) funding table',
        mode: 'csv',
        amountColumns: ['Original RAM Funding $'],
        fiscalYear: '2025-26',
        measureType: 'budget',
        labelColumns: ['School'],
        entityColumns: ['School'],
      },
    );
    expect(ram.unit).toBe('$');
    expect(ram.unitExplicit).toBe(true);
    expect(ram.amountColumns).toEqual(['Original RAM Funding $']);
    expect(ram.warnings).toEqual([]);

    const ambiguous = prepareTableContext(
      ['Allocation201617'],
      [{ Allocation201617: 250 }],
      baseContext(),
      {
        ...BUDGET_SPEC,
        unit: undefined,
        unitExplicit: undefined,
        unitEvidence: undefined,
      },
    );
    expect(ambiguous.unit).toBe('$');
    expect(ambiguous.unitExplicit).toBe(false);
    expect(ambiguous.warnings.join(' ')).toMatch(/unit not explicit/i);
  });
});

describe('generic tabular mapper — date and amount columns', () => {
  it('detects amount columns and financial years encoded in headers', () => {
    expect(
      detectAmountColumns([
        'School Code',
        'School Full Name',
        'Original RAM Funding $',
        'Enrolment Count',
      ]),
    ).toEqual(['Original RAM Funding $']);
    expect(detectAmountColumns(['Allocation201415', 'ETC', 'ProjectName'])).toEqual([
      'Allocation201415',
    ]);
    expect(fiscalYearFromColumnHeader('Allocation201415')).toBe('2014-15');
    expect(fiscalYearFromColumnHeader('Allocation201516')).toBe('2015-16');
    expect(fiscalYearFromColumnHeader('Allocation201617')).toBe('2016-17');
    expect(fiscalYearFromColumnHeader('FY2025-26')).toBe('2025-26');
    expect(fiscalYearFromColumnHeader('2026-27 allocation')).toBe('2026-27');
    expect(fiscalYearFromColumnHeader('School Code')).toBeNull();
  });

  it('maps multi-column budget rows, rejects totals and preserves provenance', () => {
    const context = prepareTableContext(
      Object.keys(BUDGET_ROWS[0]!),
      BUDGET_ROWS,
      baseContext(),
      BUDGET_SPEC,
    );
    const result = mapNswCkanTable(BUDGET_ROWS, context);

    expect(result.sourceRows).toBe(3);
    expect(result.rowsWithRecords).toBe(2);
    expect(result.records).toHaveLength(4);
    expect(result.rejectedRows).toHaveLength(1);
    expect(result.rejectedRows[0]!.reason).toMatch(/total\/subtotal row excluded/i);
    expect(result.duplicates).toBe(0);

    const lotus = result.records.filter((record) => record.project_name?.includes('Lotus'));
    expect(lotus.map((record) => record.fiscal_year)).toEqual(['2014-15', '2015-16', '2016-17']);
    expect(lotus.map((record) => record.amount_cents)).toEqual([
      181_000_000, 307_400_000, 70_000_000,
    ]);
    for (const record of result.records) {
      expect(record.source_id).toBe('data-nsw-ckan');
      expect(record.jurisdiction_level).toBe('state');
      expect(record.jurisdiction).toBe('NSW');
      expect(record.source_url).toBe('https://data.nsw.gov.au/data/dataset/nsw-budget-paper-2');
      expect(record.measure_type).toBe('budget');
      expect(record.verified).toBe(false);
      expect(record.natural_key).toMatch(/^data-nsw-ckan:[a-f0-9]{40}$/);
      expect(record.amount_cents).toBe(Math.round(record.amount_cents));
      expect(record.notes).toContain('sha256: ' + 'a'.repeat(64));
      expect(record.notes).toContain('source_detail:');
      expect(record.data_quality_flag).toBe('provisional');
    }
    expect(result.records[0]!.location).toEqual({ state: 'NSW', lga_name: 'Sydney' });
    expect(result.records[0]!.function_code).toBeUndefined();
    const fire = result.records.find((record) => record.delivery_entity === 'Fire and Rescue NSW');
    expect(fire?.function_code).toBe('03');
  });

  it('forces provisional quality when the measure type/unit mapping is ambiguous', () => {
    const fleetSpec: NswCkanResourceSpec = {
      id: 'fleet',
      name: 'Fleet Vehicle expenditure data FY18-19.xlsx',
      mode: 'xlsx',
      amountColumns: ['Invoice Charge (exc GST)'],
      fiscalYear: '2018-19',
      measureType: 'actual',
      measureTypeRationale:
        'Historical reported spend; not described as audited, so flagged provisional.',
      qualityWarning:
        'Historical reported spend, not described as audited; measure_type actual is the closest type and every row is flagged provisional.',
      labelColumns: ['Cluster'],
      entityColumns: ['Cluster'],
    };
    const rows: RawRecord[] = [{ Cluster: 'Health', 'Invoice Charge (exc GST)': 89910287 }];
    const context = prepareTableContext(
      ['Cluster', 'Invoice Charge (exc GST)'],
      rows,
      baseContext({
        mode: 'xlsx',
        resourceId: 'fleet',
        resourceName: 'Fleet Vehicle expenditure data FY18-19.xlsx',
        resourceFormat: 'excel (xlsx)',
        measureType: 'actual',
        measureTypeRationale:
          'Historical reported spend; not described as audited, so flagged provisional.',
        labelColumns: ['Cluster'],
        entityColumns: ['Cluster'],
        lgaColumns: [],
        cellFormats: { 'Invoice Charge (exc GST)': '"$"#,##0' },
      }),
      fleetSpec,
    );
    const result = mapNswCkanTable(rows, context);
    expect(context.unit).toBe('$');
    expect(context.unitExplicit).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]!.amount_cents).toBe(8_991_028_700);
    expect(result.records[0]!.data_quality_flag).toBe('provisional');
    expect(result.records[0]!.function_code).toBe('07');
    expect(result.warnings.join(' ')).toMatch(/not described as audited/);
  });

  it('is idempotent and de-duplicates exact source rows by natural_key', () => {
    const context = prepareTableContext(
      Object.keys(BUDGET_ROWS[0]!),
      BUDGET_ROWS,
      baseContext(),
      BUDGET_SPEC,
    );
    const first = mapNswCkanTable(BUDGET_ROWS, context);
    const second = mapNswCkanTable(BUDGET_ROWS, context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
    expect(second.records.map((record) => record.amount_cents)).toEqual(
      first.records.map((record) => record.amount_cents),
    );

    const repeated = mapNswCkanTable([...BUDGET_ROWS, ...BUDGET_ROWS], context);
    expect(repeated.records).toHaveLength(first.records.length);
    expect(repeated.duplicates).toBe(first.records.length);

    expect(nswCkanNaturalKey('pkg', 'res', 'hash')).toBe(nswCkanNaturalKey('pkg', 'res', 'hash'));
    expect(nswCkanNaturalKey('pkg', 'res', 'hash')).not.toBe(
      nswCkanNaturalKey('pkg', 'res', 'other'),
    );
    expect(nswCkanRowHash(BUDGET_ROWS[0]!, 'Allocation201617')).toBe(
      nswCkanRowHash(BUDGET_ROWS[0]!, 'Allocation201617'),
    );
  });
});

describe('generic tabular mapper — CSV/XLSX readers', () => {
  it('parses CSV values with $ and commas and trims headers', () => {
    const rows = parseCsvRows(
      'School Code,School Full Name,Original RAM Funding $\r\n1001,Abbotsford Public School,"$329,779"\r\n',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      'School Code': '1001',
      'School Full Name': 'Abbotsford Public School',
      'Original RAM Funding $': '$329,779',
    });
  });

  it('reads a titled XLSX sheet, captures number formats and stops at a blank separator', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Spend');
    sheet.getRow(2).getCell(2).value = 'Fleet Vehicle Spend by Invoice FY2018-19';
    sheet.getRow(3).getCell(3).value = 'Cluster';
    sheet.getRow(3).getCell(4).value = 'Invoice Charge (exc GST)';
    sheet.getRow(4).getCell(3).value = 'Health';
    const amount = sheet.getRow(4).getCell(4);
    amount.value = 89910287;
    amount.numFmt = '"$"#,##0';
    sheet.getRow(6).getCell(3).value = 'Fleet Vehicle Count by Cluster FY2018-19';
    sheet.getRow(7).getCell(3).value = 'Cluster';
    sheet.getRow(7).getCell(4).value = 'Leased';
    sheet.getRow(8).getCell(3).value = 'Education';
    sheet.getRow(8).getCell(4).value = 1249;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const table = await readXlsxTable(buffer, 'Spend', 3);
    expect(table.sheet).toBe('Spend');
    expect(table.headers).toContain('Cluster');
    expect(table.headers).toContain('Invoice Charge (exc GST)');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toMatchObject({
      Cluster: 'Health',
      'Invoice Charge (exc GST)': 89910287,
    });
    expect(table.cellFormats['Invoice Charge (exc GST)']).toBe('"$"#,##0');
  });
});
