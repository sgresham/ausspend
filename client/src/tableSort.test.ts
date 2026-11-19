import { describe, expect, it } from 'vitest';
import {
  compareTableRows,
  sortTableRows,
  type SortableRow,
  type TableSortState,
} from './tableSort';

const rows: SortableRow[] = [
  { id: 'b', fiscal_year: '2024-25', amount_cents: 200 },
  { id: 'a', fiscal_year: '2024-25', amount_cents: 200 },
  { id: 'c', fiscal_year: '2024-25', amount_cents: 900 },
  { id: 'd', fiscal_year: '2025-26', amount_cents: 100 },
  { id: 'e', fiscal_year: '2023-24', amount_cents: 5_000 },
];

const ids = (state: TableSortState) => sortTableRows(rows, state).map((row) => row.id);

describe('default table order', () => {
  it('sorts fiscal year descending, then amount descending', () => {
    expect(ids({ key: 'fiscal_year', direction: 'desc' })).toEqual(['d', 'c', 'a', 'b', 'e']);
  });

  it('uses id as a deterministic tie-breaker for equal year and amount', () => {
    const tied: SortableRow[] = [
      { id: 'z', fiscal_year: '2024-25', amount_cents: 100 },
      { id: 'a', fiscal_year: '2024-25', amount_cents: 100 },
    ];
    expect(
      sortTableRows(tied, { key: 'fiscal_year', direction: 'desc' }).map((row) => row.id),
    ).toEqual(['a', 'z']);
  });
});

describe('column toggles', () => {
  it('toggles fiscal year ascending while keeping amount descending as the tie-break', () => {
    expect(ids({ key: 'fiscal_year', direction: 'asc' })).toEqual(['e', 'c', 'a', 'b', 'd']);
  });

  it('sorts amount descending, then fiscal year descending', () => {
    expect(ids({ key: 'amount', direction: 'desc' })).toEqual(['e', 'c', 'a', 'b', 'd']);
  });

  it('sorts amount ascending', () => {
    expect(ids({ key: 'amount', direction: 'asc' })).toEqual(['d', 'a', 'b', 'c', 'e']);
  });
});

describe('defensive comparisons', () => {
  it('sorts missing fiscal years and amounts last in both directions', () => {
    const sparse: SortableRow[] = [
      { id: 'missing-year', fiscal_year: null, amount_cents: 10 },
      { id: 'missing-amount', fiscal_year: '2024-25', amount_cents: null },
      { id: 'present', fiscal_year: '2024-25', amount_cents: 20 },
    ];
    expect(
      sortTableRows(sparse, { key: 'fiscal_year', direction: 'desc' }).map((row) => row.id),
    ).toEqual(['present', 'missing-amount', 'missing-year']);
    expect(sortTableRows(sparse, { key: 'amount', direction: 'asc' }).map((row) => row.id)).toEqual(
      ['missing-year', 'present', 'missing-amount'],
    );
  });

  it('does not mutate the input array', () => {
    const input: SortableRow[] = [
      { id: '1', fiscal_year: '2023-24', amount_cents: 1 },
      { id: '2', fiscal_year: '2024-25', amount_cents: 2 },
    ];
    sortTableRows(input, { key: 'fiscal_year', direction: 'desc' });
    expect(input.map((row) => row.id)).toEqual(['1', '2']);
  });

  it('compares directly without needing array helpers', () => {
    const a: SortableRow = { id: 'a', fiscal_year: '2024-25', amount_cents: 10 };
    const b: SortableRow = { id: 'b', fiscal_year: '2024-25', amount_cents: 20 };
    expect(compareTableRows(a, b, { key: 'amount', direction: 'desc' })).toBeGreaterThan(0);
    expect(compareTableRows(a, b, { key: 'amount', direction: 'asc' })).toBeLessThan(0);
    expect(compareTableRows(a, a, { key: 'amount', direction: 'asc' })).toBe(0);
  });
});
