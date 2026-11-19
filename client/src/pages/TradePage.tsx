import { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { apiGet, buildQuery } from '../api';
import type {
  TradeCommoditiesResponse,
  TradeDataQualityFlag,
  TradeResponse,
  TradeRow,
  TradeYearsResponse,
} from '../api/types';
import { useApi } from '../hooks/useApi';
import { Amount, ProvenanceFooter } from '../components/Provenance';
import { ApiErrorState, EmptyState, LoadingState } from '../components/StatusViews';
import { titleCase } from '../format';
import { useTableSort } from '../tableSort';

/**
 * Read-only ABS international trade view. Trade values are a different
 * analytical domain from government spending: they are never joined to, or
 * summed with, spending records and no combined total is computed here.
 *
 * The full ABS history is now stored. The page asks the API for one financial
 * year and one bounded page at a time; it never downloads the whole history.
 */
const PAGE_SIZE = 20;

/** ABS-only. CIF/FOB and the other measures are not surfaced in this view. */
const MEASURE = 'trade_value' as const;

const ABS_PROVENANCE = {
  source_id: 'abs-international-trade',
  source_url: 'https://www.abs.gov.au/statistics/economy/international-trade',
  verified: true,
  notes:
    'ABS International Trade (Data API Beta), current prices, original series. Goods are monthly observations from the earliest available month; services are financial-year observations for every available year. Parent and child commodity rows are not additive.',
};

const EMPTY_TRADE_RESPONSE: TradeResponse = {
  filters: { measure_type: MEASURE },
  rows: [],
  summary: [],
  counts: { rows: 0, total: 0, by_measure_type: {} },
  pagination: { limit: PAGE_SIZE, offset: 0, total: 0 },
  warning: '',
  note: '',
};

const QUALITY_STYLE: Record<
  TradeDataQualityFlag,
  { label: string; color: 'success' | 'warning' | 'default' | 'info' }
> = {
  verified: { label: 'Observed — verified', color: 'success' },
  observed: { label: 'Observed', color: 'success' },
  provisional: { label: 'Provisional', color: 'warning' },
  estimated: { label: 'Estimated', color: 'warning' },
};

function QualityChip({ flag }: { flag: TradeDataQualityFlag }) {
  const style = QUALITY_STYLE[flag];
  return (
    <Chip
      size="small"
      variant="outlined"
      color={style.color}
      label={style.label}
      data-testid="trade-quality"
    />
  );
}

function TradeTable({ rows }: { rows: TradeRow[] }) {
  const { sortedRows, sortKey, sortDirection, onSort, ariaSortFor } = useTableSort(rows);

  return (
    <TableContainer component={Card} variant="outlined" data-testid="trade-table">
      <Table size="small" aria-label="ABS trade observations">
        <TableHead>
          <TableRow>
            <TableCell
              sortDirection={sortKey === 'fiscal_year' ? sortDirection : false}
              aria-sort={ariaSortFor('fiscal_year')}
            >
              <TableSortLabel
                active={sortKey === 'fiscal_year'}
                direction={sortKey === 'fiscal_year' ? sortDirection : 'asc'}
                onClick={() => onSort('fiscal_year')}
              >
                Financial year
              </TableSortLabel>
            </TableCell>
            <TableCell>Flow</TableCell>
            <TableCell>Commodity / service</TableCell>
            <TableCell>Period</TableCell>
            <TableCell
              align="right"
              sortDirection={sortKey === 'amount' ? sortDirection : false}
              aria-sort={ariaSortFor('amount')}
            >
              <TableSortLabel
                active={sortKey === 'amount'}
                direction={sortKey === 'amount' ? sortDirection : 'asc'}
                onClick={() => onSort('amount')}
              >
                Trade value
              </TableSortLabel>
            </TableCell>
            <TableCell>Data quality</TableCell>
            <TableCell>Source</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={row.id} data-testid="trade-row">
              <TableCell>{row.financial_year}</TableCell>
              <TableCell>{titleCase(row.trade_flow)}</TableCell>
              <TableCell>
                {row.commodity_name}
                {row.commodity_code ? (
                  <Typography variant="caption" component="div" color="text.secondary">
                    code {row.commodity_code}
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell>{row.time_period ?? '—'}</TableCell>
              <TableCell align="right">
                <Amount cents={row.amount_cents} />
              </TableCell>
              <TableCell>
                <QualityChip flag={row.data_quality_flag} />
              </TableCell>
              <TableCell>
                <Link
                  href={row.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                >
                  ABS Data API
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function TradePage() {
  const [flow, setFlow] = useState<'export' | 'import'>('export');
  // null means "use the latest available financial year".
  const [year, setYear] = useState<string | null>(null);
  const [commodity, setCommodity] = useState('');
  const [page, setPage] = useState(0);

  const yearsState = useApi<TradeYearsResponse>(`trade-years:${MEASURE}:${flow}`, () =>
    apiGet<TradeYearsResponse>(
      `/api/v1/trade/years${buildQuery({
        measure_type: MEASURE,
        trade_flow: flow,
      })}`,
    ),
  );

  const availableYears = yearsState.data?.years ?? [];
  const selectedYear = year ?? availableYears[0] ?? '';
  const ready = yearsState.data !== null;

  const commoditiesState = useApi<TradeCommoditiesResponse>(
    `trade-commodities:${MEASURE}:${flow}:${ready ? 'ready' : 'wait'}:${selectedYear}`,
    () => {
      if (!ready) {
        return Promise.resolve({
          filters: { measure_type: MEASURE },
          commodities: [],
          count: 0,
          warning: '',
        });
      }
      return apiGet<TradeCommoditiesResponse>(
        `/api/v1/trade/commodities${buildQuery({
          measure_type: MEASURE,
          trade_flow: flow,
          financial_year: selectedYear || undefined,
        })}`,
      );
    },
  );

  const state = useApi<TradeResponse>(
    `trade-rows:${MEASURE}:${flow}:${ready ? 'ready' : 'wait'}:${selectedYear}:${commodity}:${page}`,
    () => {
      if (!ready) return Promise.resolve(EMPTY_TRADE_RESPONSE);
      return apiGet<TradeResponse>(
        `/api/v1/trade${buildQuery({
          measure_type: MEASURE,
          trade_flow: flow,
          financial_year: selectedYear || undefined,
          commodity: commodity || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        })}`,
      );
    },
  );

  const data = state.data;
  const rows = data?.rows ?? [];
  const commodities = commoditiesState.data?.commodities ?? [];
  const total = data?.counts.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const loading = yearsState.loading || state.loading || commoditiesState.loading;
  const error = yearsState.error ?? state.error ?? commoditiesState.error;

  const setFlowAndReset = (next: 'export' | 'import') => {
    setFlow(next);
    setYear(null);
    setCommodity('');
    setPage(0);
  };

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Trade
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Australian goods and services trade values from the Australian Bureau of Statistics. This is
        a <strong>separate analytical layer</strong> from government spending. Values are shown by
        flow, financial year and commodity/service label; each observation keeps its own published
        units and quality flag.
      </Typography>

      <Alert severity="warning" data-testid="trade-caveat" sx={{ mb: 3 }}>
        <AlertTitle>Trade value — not spending and not profit</AlertTitle>A trade value is the value
        of goods or services crossing the border. It is not expenditure by an Australian government
        and it is never added to a spending total. Trade measures are
        <strong> non-additive</strong>: goods and services rows, and parent and child commodity
        rows, are different measures and are not summed here. Any CIF/FOB figure is a{' '}
        <strong>border cost</strong>, not a margin or profit; no CIF/FOB or profit estimate is shown
        in this ABS view.
      </Alert>

      <Card variant="outlined" sx={{ mb: 3 }} data-testid="trade-source">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h6" component="h2">
              ABS International Trade (Data API Beta)
            </Typography>
            <Chip size="small" variant="outlined" label="measure: trade value" />
            <Chip size="small" variant="outlined" label="jurisdiction: federal" />
            <Chip size="small" variant="outlined" label="unit: AUD" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Current-price, original-series observations. Goods rows are monthly from the earliest
            available month; services rows are financial-year totals for every available year. The
            page loads one flow and one financial year at a time, with a bounded server-side page,
            so it never downloads the full history. The latest financial year may be partial; each
            observation keeps its published month or annual label.
          </Typography>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="trade-flow-label">Flow</InputLabel>
          <Select
            labelId="trade-flow-label"
            label="Flow"
            value={flow}
            onChange={(event) => setFlowAndReset(event.target.value as 'export' | 'import')}
            inputProps={{ 'data-testid': 'trade-flow' }}
          >
            <MenuItem value="export">Exports</MenuItem>
            <MenuItem value="import">Imports</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="trade-year-label">Financial year</InputLabel>
          <Select
            labelId="trade-year-label"
            label="Financial year"
            value={year ?? availableYears[0] ?? ''}
            onChange={(event) => {
              setYear(event.target.value);
              setCommodity('');
              setPage(0);
            }}
            inputProps={{ 'data-testid': 'trade-year' }}
          >
            <MenuItem value="">All years</MenuItem>
            {availableYears.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 280, flexGrow: 1 }}>
          <InputLabel id="trade-commodity-label">Commodity / service</InputLabel>
          <Select
            labelId="trade-commodity-label"
            label="Commodity / service"
            value={commodity}
            onChange={(event) => {
              setCommodity(event.target.value);
              setPage(0);
            }}
            inputProps={{ 'data-testid': 'trade-commodity' }}
          >
            <MenuItem value="">All commodities and services</MenuItem>
            {commodities.map((item) => (
              <MenuItem key={item.commodity_name} value={item.commodity_name}>
                {item.commodity_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {availableYears.length > 0 ? (
        <Typography variant="caption" component="p" color="text.secondary" sx={{ mb: 1 }}>
          Available financial years: {availableYears[0]} to{' '}
          {availableYears[availableYears.length - 1]} ({availableYears.length} years). The latest
          year may be partial.
        </Typography>
      ) : null}

      {loading ? <LoadingState label="Loading ABS trade observations…" /> : null}
      {error ? (
        <ApiErrorState
          error={error}
          hint="Trade data is read from the ausspend API. If the API is unavailable, no trade value is shown."
        />
      ) : null}

      {data && !loading && !error ? (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`${total} matching observations`}
            />
            <Chip size="small" variant="outlined" label={`${titleCase(flow)} trade value (ABS)`} />
            <Chip size="small" variant="outlined" label="no combined total" />
            <Chip size="small" variant="outlined" label={`page ${safePage + 1} of ${pageCount}`} />
          </Stack>

          {rows.length === 0 ? (
            <EmptyState
              title="No trade observations match these filters"
              message="No ABS trade rows match the selected flow, financial year and commodity. Try clearing a filter; nothing is estimated or zero-filled."
            />
          ) : (
            <>
              <TradeTable rows={rows} />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems="center"
                sx={{ mt: 2 }}
                data-testid="trade-pagination"
              >
                <Typography variant="body2" color="text.secondary">
                  Showing {data.pagination.offset + 1}–{data.pagination.offset + rows.length} of{' '}
                  {total}
                </Typography>
                <Pagination
                  page={safePage + 1}
                  count={pageCount}
                  onChange={(_event, value) => setPage(value - 1)}
                  size="small"
                />
              </Stack>
            </>
          )}

          <ProvenanceFooter
            sources={[ABS_PROVENANCE]}
            note="Rows from different trade measures and sources are never combined into one total, and trade data is never joined to spending data."
          />
        </>
      ) : null}
    </Box>
  );
}
