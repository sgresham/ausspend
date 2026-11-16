import type { MeasureRow, MeasureType } from './api/types';

export const LIMIT_FOR_TOTALS = 1000;

/** Fiscal years present in a set of measure rows, newest first. */
export function fiscalYearsFromRows(rows: readonly MeasureRow[]): string[] {
  return [...new Set(rows.map((row) => row.fiscal_year))].sort((a, b) => b.localeCompare(a));
}

const EMPTY_TOTALS: Record<MeasureType, number> = {
  actual: 0,
  budget: 0,
  estimate: 0,
};

/** Sum integer cents per measure type. Never produces a combined total. */
export function measureTypeTotals(rows: readonly MeasureRow[]): Record<MeasureType, number> {
  const totals: Record<MeasureType, number> = { ...EMPTY_TOTALS };
  for (const row of rows) {
    totals[row.measure_type] += row.amount_cents;
  }
  return totals;
}
