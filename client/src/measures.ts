import type { MeasureType, PerMeasureTypeTotal } from './api/types';

const EMPTY_TOTALS: Record<MeasureType, number> = {
  actual: 0,
  budget: 0,
  estimate: 0,
  contract: 0,
  grant_award: 0,
};

/**
 * Turn the API's per-measure-type totals into the shape chart components need.
 * This never sums rows client-side: every value comes straight from
 * `total_by_measure_type` in the response.
 */
export function typeTotalsFromApi(
  totals: readonly PerMeasureTypeTotal[],
): Record<MeasureType, number> {
  const result: Record<MeasureType, number> = { ...EMPTY_TOTALS };
  for (const entry of totals) {
    result[entry.measure_type] = entry.total_cents;
  }
  return result;
}
