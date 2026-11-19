import { useCallback, useMemo, useState } from 'react';

/**
 * Shared sorting for the row tables.
 *
 * The default order is fiscal year descending, then amount descending, with
 * the row id (then project/description/commodity) as a deterministic final
 * tie-breaker. Amounts are integer cents and fiscal years are ISO-like
 * `YYYY-YY` strings, so both compare without parsing or locale surprises.
 *
 * The hook sorts only the rows it is given. For server-paginated tables that
 * means the visible page: it never changes the API query, totals, grouping or
 * pagination.
 */
export type TableSortKey = 'fiscal_year' | 'amount';
export type TableSortDirection = 'asc' | 'desc';

export interface TableSortState {
  key: TableSortKey;
  direction: TableSortDirection;
}

/** Minimal shape shared by measure, spending and trade rows. */
export interface SortableRow {
  id?: string | null;
  fiscal_year?: string | null;
  amount_cents?: number | null;
  project_name?: string | null;
  description?: string | null;
  commodity_name?: string | null;
}

function isEmpty(value: string | null | undefined): value is null | undefined | '' {
  return value === null || value === undefined || value === '';
}

function compareText(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: TableSortDirection,
): number {
  if (a === b) return 0;
  // Missing values sort last regardless of direction.
  if (isEmpty(a)) return 1;
  if (isEmpty(b)) return -1;
  const result = a.localeCompare(b);
  return direction === 'asc' ? result : -result;
}

function compareNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: TableSortDirection,
): number {
  const aMissing = a === null || a === undefined || Number.isNaN(a);
  const bMissing = b === null || b === undefined || Number.isNaN(b);
  if (aMissing && bMissing) return 0;
  // Missing values sort last regardless of direction.
  if (aMissing) return 1;
  if (bMissing) return -1;
  const result = a - b;
  return direction === 'asc' ? result : -result;
}

/**
 * Final tie-breaker always compares ascending so two rows with the same
 * fiscal year and amount keep a stable, reproducible order.
 */
function compareTieBreak(a: SortableRow, b: SortableRow): number {
  return (
    compareText(a.id, b.id, 'asc') ||
    compareText(a.project_name, b.project_name, 'asc') ||
    compareText(a.description, b.description, 'asc') ||
    compareText(a.commodity_name, b.commodity_name, 'asc')
  );
}

/**
 * Compare two rows for the chosen column.
 *
 * Convention: amount is always the secondary key in the default direction
 * (descending), and fiscal year is the secondary key descending when amount is
 * the active column. This keeps the "fiscal year desc, then amount desc"
 * contract stable while still letting a header toggle its primary direction.
 */
export function compareTableRows(a: SortableRow, b: SortableRow, state: TableSortState): number {
  if (state.key === 'fiscal_year') {
    const fiscalYear = compareText(a.fiscal_year, b.fiscal_year, state.direction);
    if (fiscalYear !== 0) return fiscalYear;
    const amount = compareNumber(a.amount_cents, b.amount_cents, 'desc');
    if (amount !== 0) return amount;
  } else {
    const amount = compareNumber(a.amount_cents, b.amount_cents, state.direction);
    if (amount !== 0) return amount;
    const fiscalYear = compareText(a.fiscal_year, b.fiscal_year, 'desc');
    if (fiscalYear !== 0) return fiscalYear;
  }
  return compareTieBreak(a, b);
}

/** Pure, non-mutating sort used by the hook and by tests. */
export function sortTableRows<T extends SortableRow>(
  rows: readonly T[],
  state: TableSortState,
): T[] {
  return [...rows].sort((a, b) => compareTableRows(a, b, state));
}

export const DEFAULT_TABLE_SORT: TableSortState = { key: 'fiscal_year', direction: 'desc' };
export const DEFAULT_AMOUNT_SORT: TableSortState = { key: 'amount', direction: 'desc' };

export interface UseTableSortOptions {
  /** Start with amount only for tables that genuinely have no fiscal-year column. */
  amountOnly?: boolean;
  defaultState?: TableSortState;
}

/**
 * Sort a table's current rows. Clicking the active header toggles
 * ascending/descending; clicking a different header starts descending.
 */
export function useTableSort<T extends SortableRow>(
  rows: readonly T[],
  options: UseTableSortOptions = {},
) {
  const [state, setState] = useState<TableSortState>(
    options.defaultState ?? (options.amountOnly ? DEFAULT_AMOUNT_SORT : DEFAULT_TABLE_SORT),
  );

  const sortedRows = useMemo(() => sortTableRows(rows, state), [rows, state]);

  const onSort = useCallback((key: TableSortKey) => {
    setState((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    );
  }, []);

  const isSortedBy = useCallback((key: TableSortKey) => state.key === key, [state.key]);

  const ariaSortFor = useCallback(
    (key: TableSortKey): 'ascending' | 'descending' | 'none' => {
      if (state.key !== key) return 'none';
      return state.direction === 'asc' ? 'ascending' : 'descending';
    },
    [state],
  );

  return {
    sortedRows,
    sortKey: state.key,
    sortDirection: state.direction,
    onSort,
    isSortedBy,
    ariaSortFor,
  };
}
