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
  Typography,
} from '@mui/material';
import { apiGet, buildQuery } from '../api';
import type { TradeDataQualityFlag, TradeResponse, TradeRow } from '../api/types';
import { useApi } from '../hooks/useApi';
import { Amount, ProvenanceFooter } from '../components/Provenance';
import { ApiErrorState, EmptyState, LoadingState } from '../components/StatusViews';
import { titleCase } from '../format';

/**
 * Read-only ABS international trade view. Trade values are a different
 * analytical domain from government spending: they are never joined to, or
 * summed with, spending records and no combined total is computed here.
 */
const PAGE_SIZE = 20;

/** ABS-only. CIF/FOB and the other measures are not surfaced in this view. */
const MEASURE = 'trade_value' as const;

const ABS_PROVENANCE = {
  source_id: 'abs-international-trade',
  source_url: 'https://www.abs.gov.au/statistics/economy/international-trade',
  verified: true,
  notes:
    'ABS International Trade (Data API Beta), current prices. Goods are monthly observations; services are financial-year observations. Parent and child commodity rows are not additive.',
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

function TradeTable({ rows, page }: { rows: TradeRow[]; page: number }) {
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <TableContainer component={Card} variant="outlined" data-testid="trade-table">
      <Table size="small" aria-label="ABS trade observations">
        <TableHead>
          <TableRow>
            <TableCell>Financial year</TableCell>
            <TableCell>Flow</TableCell>
            <TableCell>Commodity / service</TableCell>
            <TableCell>Period</TableCell>
            <TableCell align="right">Trade value</TableCell>
            <TableCell>Data quality</TableCell>
            <TableCell>Source</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((row) => (
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
  const [year, setYear] = useState('');
  const [commodity, setCommodity] = useState('');
  const [page, setPage] = useState(0);

  const state = useApi(`trade:${MEASURE}:${flow}`, () =>
    apiGet<TradeResponse>(
      `/api/v1/trade${buildQuery({
        measure_type: MEASURE,
        trade_flow: flow,
      })}`,
    ),
  );

  const data = state.data;
  const rows = data?.rows ?? [];

  const years = [...new Set(rows.map((row) => row.financial_year))].sort().reverse();
  const commodities = [...new Set(rows.map((row) => row.commodity_name))].sort((a, b) =>
    a.localeCompare(b),
  );

  const filtered = rows.filter(
    (row) =>
      (year === '' || row.financial_year === year) &&
      (commodity === '' || row.commodity_name === commodity),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);

  const setFlowAndReset = (next: 'export' | 'import') => {
    setFlow(next);
    setYear('');
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
            Current-price observations. Goods rows are monthly; services rows are financial-year
            totals. The page loads one flow at a time and pages the rendered rows, so it does not
            dump the full result set onto the screen.
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
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              setPage(0);
            }}
            inputProps={{ 'data-testid': 'trade-year' }}
          >
            <MenuItem value="">All years</MenuItem>
            {years.map((item) => (
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
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {state.loading ? <LoadingState label="Loading ABS trade observations…" /> : null}
      {state.error ? (
        <ApiErrorState
          error={state.error}
          hint="Trade data is read from the ausspend API. If the API is unavailable, no trade value is shown."
        />
      ) : null}

      {data ? (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`${filtered.length} matching observations`}
            />
            <Chip size="small" variant="outlined" label={`${titleCase(flow)} trade value (ABS)`} />
            <Chip size="small" variant="outlined" label="no combined total" />
          </Stack>

          {rows.length > PAGE_SIZE ? (
            <Typography variant="caption" component="p" color="text.secondary" sx={{ mb: 1 }}>
              Showing a page of the filtered observations. {rows.length} stored {flow} rows were
              loaded for this flow; the table renders {PAGE_SIZE} at a time.
            </Typography>
          ) : null}

          {filtered.length === 0 ? (
            <EmptyState
              title="No trade observations match these filters"
              message="No ABS trade rows match the selected flow, financial year and commodity. Try clearing a filter; nothing is estimated or zero-filled."
            />
          ) : (
            <>
              <TradeTable rows={filtered} page={safePage} />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems="center"
                sx={{ mt: 2 }}
                data-testid="trade-pagination"
              >
                <Typography variant="body2" color="text.secondary">
                  Showing {safePage * PAGE_SIZE + 1}–
                  {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
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
