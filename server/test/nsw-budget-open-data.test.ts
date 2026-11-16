import { describe, expect, it } from 'vitest';
import {
  ARCGIS_EXPECTED_PROJECTS,
  NSW_FISCAL_YEAR,
  NSW_ID,
  UNIT_TO_CENTS,
  amountToCents,
  detectFinancialHeader,
  discoverNswFiles,
  financialRawRows,
  financialYearOf,
  hfiRawRows,
  mapCapitalFeature,
  measureTypeForFinancialHeader,
  measureTypeForIndicatorYear,
  nswNaturalKey,
  transformNswRaw,
  type NswSourceFile,
  type NswWorkbookRows,
} from '../src/connectors/index.js';
import type { RawRecord } from '../src/connectors/types.js';

const financialFile: NswSourceFile = {
  filename: '2025-26-Budget-Financial-Statements.xlsx',
  title: 'Financial Statements',
  category: 'financial',
  url: 'https://www.budget.nsw.gov.au/sites/default/files/2025-06/2025-26-Budget-Financial-Statements.xlsx',
  snapshot_timestamp: '20251112191742',
  snapshot_url: 'https://web.archive.org/web/20251112191742id_/x.xlsx',
  sha256: 'abc',
  bytes: 1,
};

const hfiFile: NswSourceFile = {
  filename: 'Open-Data-2025-26-Budget-Historical-Fiscal-Indicators.xlsx',
  title: 'Historical Fiscal Indicators',
  category: 'hfi',
  url: 'https://www.budget.nsw.gov.au/sites/default/files/2025-06/Open-Data-2025-26-Budget-Historical-Fiscal-Indicators.xlsx',
  snapshot_timestamp: '20251112192558',
  snapshot_url: 'https://web.archive.org/web/20251112192558id_/x.xlsx',
  sha256: 'def',
  bytes: 1,
};

function financialWorkbook(): NswWorkbookRows {
  return {
    sheets: [
      {
        name: 'GG Operating Statement',
        rows: [
          {
            number: 4,
            values: [null, null, '2023-24', '2024-25', '2025-26', '2026-27', '2027-28', '2028-29'],
          },
          {
            number: 5,
            values: [null, null, 'Actual', 'Revised', 'Budget', 'Forward Estimates'],
          },
          { number: 6, values: [null, null, '$m', '$m', '$m', '$m', '$m', '$m'] },
          {
            number: 7,
            values: [null, 'Revenue from Transactions', null, null, null, null, null, null],
          },
          {
            number: 8,
            values: [
              null,
              'Taxation',
              44603.2656120131,
              47599.03,
              51318.06,
              54138.03,
              56668.42,
              59540.53,
            ],
          },
          {
            number: 9,
            values: [null, 'Expenses from Transactions', null, null, null, null, null, null],
          },
          {
            number: 10,
            values: [null, 'Employee', 46130.91, 48514.16, 50307.42, 51912.61, 53129.08, 56205.58],
          },
          {
            number: 11,
            values: [
              null,
              'Other Operating Expense',
              27993.67,
              27191.94,
              27775.93,
              26153.96,
              27805.99,
              27497.07,
            ],
          },
          {
            number: 12,
            values: [
              null,
              'Total Expenses from Transactions',
              74124.58,
              75706.1,
              78083.35,
              78066.57,
              80935.07,
              83702.65,
            ],
          },
          {
            number: 13,
            values: [
              null,
              'Budget result (deficit)',
              -10689.82,
              -5715.43,
              -3427.03,
              -1148.09,
              -1000,
              -900,
            ],
          },
        ],
      },
      {
        name: 'GG Cashflow Statement',
        rows: [
          { number: 4, values: [null, null, '2023-24', '2024-25', '2025-26'] },
          {
            number: 5,
            values: [null, null, 'Actual', 'Revised', 'Budget'],
          },
          { number: 6, values: [null, null, '$m', '$m', '$m'] },
          { number: 7, values: [null, 'Cash Receipts', 1000, 1100, 1200] },
        ],
      },
    ],
  };
}

function hfiWorkbook(): NswWorkbookRows {
  return {
    sheets: [
      {
        name: 'Table D.1 - App E',
        rows: [
          {
            number: 2,
            values: [
              null,
              'Revenue',
              null,
              'Expenses',
              null,
              'Budget Result',
              null,
              'Capital Expenditure',
              null,
              'GSP',
            ],
          },
          {
            number: 3,
            values: [
              null,
              '$b',
              '% Growth',
              '$b',
              '% Growth',
              '$b',
              '% of GSP',
              '$b',
              '% of GSP',
              '$b',
            ],
          },
          { number: 4, values: ['2025-26', 124.2, 5.1, 127.6, 3, -3.4, -0.4, 22.3, 2.5, 879.5] },
          { number: 5, values: ['2026-27', 128, 3.1, 129.2, 1.3, -1.1, -0.1, 22, 2.4, 922.4] },
        ],
      },
      {
        name: 'Table D.2 - App E',
        rows: [
          {
            number: 2,
            values: [
              null,
              'Net Lending/ (Borrowing)',
              null,
              'Gross Debt',
              null,
              'Net Debt',
              null,
              'Interest Expense',
            ],
          },
          {
            number: 3,
            values: [null, '$b', '% of GSP', '$b', '% of GSP', '$b', '% of GSP', '$b'],
          },
          { number: 4, values: ['2025-26', -15.6, -1.8, 178.8, 20.3, 120.3, 13.7, 7.7] },
          { number: 5, values: ['2026-27', -11.7, -1.3, 188.3, 20.4, 127.8, 13.9, 8.4] },
        ],
      },
    ],
  };
}

function capitalFeature(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    OBJECTID: 1,
    Agency_Name: 'Hunter Water Corporation',
    Project_Category: 'Major Works',
    Project_Status: 'Works in Progress',
    Electorate: 'UPPER HUNTER',
    Sector: 'Public Non-Financial Corporations',
    Cluster_PNFC_Sector: 'NA/Water',
    Region: 'Hunter',
    LGA: 'DUNGOG',
    Project_ID: '104155',
    Budget_Year_FY_2025_26_000: '1181',
    Project_name: 'Chichester Trunk Gravity Main',
    ...overrides,
  };
}

describe('NSW unit conversion', () => {
  it('uses explicit units, never a silent default', () => {
    expect(UNIT_TO_CENTS).toEqual({
      $: 100,
      $m: 100_000_000,
      $b: 100_000_000_000,
      "$'000": 100_000,
    });
    expect(amountToCents(44603.2656120131, '$m')).toBe(4_460_326_561_201);
    expect(amountToCents(32.1, '$b')).toBe(3_210_000_000_000);
    expect(amountToCents(560, "$'000")).toBe(56_000_000);
    expect(amountToCents(1.23, '$')).toBe(123);
    expect(amountToCents(1, 'thousand')).toBeNull();
    expect(amountToCents(-1, '$m')).toBeNull();
    expect(amountToCents('n.a.', "$'000")).toBeNull();
  });
});

describe('NSW fiscal-year and measure mapping', () => {
  it('parses financial years, balance-sheet dates and Excel serials', () => {
    expect(financialYearOf('2025-26')).toBe('2025-26');
    expect(financialYearOf('2027 -28')).toBe('2027-28');
    expect(financialYearOf(' June 2024')).toBe('2023-24');
    expect(financialYearOf('2025-06-30')).toBe('2024-25');
    expect(financialYearOf(46174)).toBe('2025-26');
    expect(financialYearOf('not a year')).toBeNull();
  });

  it('maps Actual/Revised/Budget/Forward Estimates and indicator years', () => {
    expect(measureTypeForFinancialHeader('Actual')).toBe('actual');
    expect(measureTypeForFinancialHeader('Revised')).toBe('estimate');
    expect(measureTypeForFinancialHeader('Budget')).toBe('budget');
    expect(measureTypeForFinancialHeader('Forward Estimates')).toBe('estimate');
    expect(measureTypeForFinancialHeader('Other')).toBeNull();
    expect(measureTypeForIndicatorYear('2024-25')).toBe('actual');
    expect(measureTypeForIndicatorYear(NSW_FISCAL_YEAR)).toBe('budget');
    expect(measureTypeForIndicatorYear('2027-28')).toBe('estimate');
  });
});

describe('NSW financial-statement sheet mapping', () => {
  it('detects the header and forward-fills Forward Estimates across all three years', () => {
    const header = detectFinancialHeader(financialWorkbook().sheets[0]!.rows);
    expect(header?.headerRow).toBe(5);
    expect(header?.columns.map((column) => column.header)).toEqual([
      'Actual',
      'Revised',
      'Budget',
      'Forward Estimates',
      'Forward Estimates',
      'Forward Estimates',
    ]);
    expect(header?.columns.map((column) => column.year)).toEqual([
      '2023-24',
      '2024-25',
      '2025-26',
      '2026-27',
      '2027-28',
      '2028-29',
    ]);
  });

  it('ingests only Operating Statement expenses, one row per FY, not flattened', () => {
    const skipped: Array<{ filename: string; sheet: string; row: number | null; reason: string }> =
      [];
    const raw = financialRawRows(financialFile, financialWorkbook(), skipped);
    expect(raw).toHaveLength(12);
    expect(raw.map((row) => row.label)).toEqual([
      'Employee',
      'Employee',
      'Employee',
      'Employee',
      'Employee',
      'Employee',
      'Other Operating Expense',
      'Other Operating Expense',
      'Other Operating Expense',
      'Other Operating Expense',
      'Other Operating Expense',
      'Other Operating Expense',
    ]);
    expect(raw.slice(0, 6).map((row) => row.fiscal_year)).toEqual([
      '2023-24',
      '2024-25',
      '2025-26',
      '2026-27',
      '2027-28',
      '2028-29',
    ]);
    expect(raw.slice(0, 6).map((row) => row.measure_type)).toEqual([
      'actual',
      'estimate',
      'budget',
      'estimate',
      'estimate',
      'estimate',
    ]);
    expect(raw.find((row) => row.label === 'Taxation')).toBeUndefined();
    expect(raw.find((row) => row.label.includes('Total Expenses'))).toBeUndefined();
    expect(skipped.some((entry) => entry.reason.includes('Taxation'))).toBe(true);
    expect(skipped.some((entry) => entry.reason.includes('non-spending statement sheet'))).toBe(
      true,
    );
  });
});

describe('NSW historical fiscal indicators', () => {
  it('ingests only Expenses, Interest Expense and Capital Expenditure $b columns', () => {
    const skipped: Array<{ filename: string; sheet: string; row: number | null; reason: string }> =
      [];
    const raw = hfiRawRows(hfiFile, hfiWorkbook(), skipped);
    expect(raw).toHaveLength(6);
    expect(new Set(raw.map((row) => row.unit))).toEqual(new Set(['$b']));
    expect(raw.map((row) => row.label)).toEqual([
      'Expenses ($b)',
      'Capital Expenditure ($b)',
      'Expenses ($b)',
      'Capital Expenditure ($b)',
      'Interest Expense ($b)',
      'Interest Expense ($b)',
    ]);
    expect(
      raw.filter((row) => row.fiscal_year === '2025-26').map((row) => row.measure_type),
    ).toEqual(['budget', 'budget', 'budget']);
    expect(
      raw.filter((row) => row.fiscal_year === '2026-27').map((row) => row.measure_type),
    ).toEqual(['estimate', 'estimate', 'estimate']);
    const reasons = skipped.map((entry) => entry.reason);
    expect(reasons).toEqual(
      expect.arrayContaining([
        'Revenue: non-spending HFI indicator excluded',
        'Budget Result: non-spending HFI indicator excluded',
        'GSP: non-spending HFI indicator excluded',
        'Gross Debt: non-spending HFI indicator excluded',
        'Net Debt: non-spending HFI indicator excluded',
      ]),
    );
  });
});

describe('NSW capital projects', () => {
  it('converts $000 to cents, carries LGA/electorate into location/notes and never infers an LGA', () => {
    const record = mapCapitalFeature(capitalFeature());
    expect(record).not.toBeNull();
    expect(record!.amount_cents).toBe(118_100_000);
    expect(record!.measure_type).toBe('budget');
    expect(record!.fiscal_year).toBe('2025-26');
    expect(record!.jurisdiction_level).toBe('state');
    expect(record!.jurisdiction).toBe('NSW');
    expect(record!.location).toEqual({ state: 'NSW', lga_name: 'DUNGOG' });
    expect(record!.notes).toContain('electorate UPPER HUNTER');
    expect(record!.function_code).toBe('06');

    const noLga = mapCapitalFeature(capitalFeature({ LGA: 'n.a.', Electorate: 'SYDNEY' }));
    expect(noLga!.location).toEqual({ state: 'NSW' });
    expect(noLga!.data_quality_flag).toBe('statewide_only');
    expect(noLga!.notes).toContain('electorate SYDNEY');
  });

  it('does not invent a project without a usable budget amount or name', () => {
    expect(mapCapitalFeature(capitalFeature({ Budget_Year_FY_2025_26_000: 'n.a.' }))).toBeNull();
    expect(mapCapitalFeature(capitalFeature({ Project_name: null }))).toBeNull();
  });
});

describe('NSW discovery and natural keys', () => {
  it('discovers workbook links by DOM/link text and ignores non-xlsx links', () => {
    const html = `
      <html><body>
        <a href="/sites/default/files/2025-06/2025-26-Budget-Financial-Statements.xlsx">Financial Statements</a>
        <a href="https://www.budget.nsw.gov.au/sites/default/files/2025-06/Open-Data-2025-26-Budget-Historical-Fiscal-Indicators.xlsx">Historical Fiscal Indicators</a>
        <a href="/sites/default/files/2025-06/2025-26-Budget-Economy-Open-Data.xlsx">Economy Open Data</a>
        <a href="/sites/default/files/2025-06/open-data-performance-and-wellbeing-healthy-nsw-budget-2025-26.xlsx">Healthy NSW</a>
        <a href="/sites/default/files/2025-06/notes.pdf">Not a workbook</a>
      </body></html>`;
    const files = discoverNswFiles(html);
    expect(files.map((file) => file.category)).toEqual([
      'economy',
      'financial',
      'hfi',
      'wellbeing',
    ]);
    expect(files.every((file) => file.url.startsWith('https://www.budget.nsw.gov.au/'))).toBe(true);
    expect(files.every((file) => file.snapshot_url.includes('web.archive.org'))).toBe(true);
  });

  it('is deterministic and idempotent on re-transform', () => {
    const raw: RawRecord[] = [
      ...financialRawRows(financialFile, financialWorkbook(), []),
      ...hfiRawRows(hfiFile, hfiWorkbook(), []),
      { kind: 'capital', feature: capitalFeature(), source_date: '2026-06-22' },
    ];
    const first = transformNswRaw(raw);
    const second = transformNswRaw(raw);
    expect(first.records).toHaveLength(19);
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(new Set(first.records.map((record) => record.natural_key)).size).toBe(
      first.records.length,
    );
    const repeated = transformNswRaw([...raw, ...raw]);
    expect(repeated.records).toHaveLength(first.records.length);
    expect(repeated.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
    expect(nswNaturalKey(['a', 'b'])).toBe(nswNaturalKey(['a', 'b']));
    expect(nswNaturalKey(['a', 'b'])).not.toBe(nswNaturalKey(['a', 'c']));
  });

  it('has a fixed ArcGIS project count and NSW source id', () => {
    expect(ARCGIS_EXPECTED_PROJECTS).toBe(974);
    expect(NSW_ID).toBe('nsw-budget');
  });
});
