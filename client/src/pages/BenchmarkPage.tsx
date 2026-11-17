import { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
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
import { Link as RouterLink } from 'react-router-dom';
import { apiGet, buildQuery } from '../api';
import type { BenchmarkResponse, PnfcBenchmarkResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { Amount, ProvenanceFooter, SourceLink, VerifiedBadge } from '../components/Provenance';
import { ApiErrorState, EmptyState, LoadingState } from '../components/StatusViews';

const LEVEL_LABELS: Record<string, string> = {
  federal: 'Federal (Commonwealth)',
  state: 'State / territory government',
  local: 'Local government',
};

/**
 * ABS GFS COFOG-A benchmark view. Every amount is a published ABS GFS aggregate
 * ("Expenses by purpose", general government sector). It is a top-down
 * statistical benchmark, not a sum of projects: this page never computes a
 * total and never adds GFS values to project rows.
 */
export function BenchmarkPage() {
  const [year, setYear] = useState<string>('');
  const state = useApi(`benchmark:${year || 'latest'}`, () =>
    apiGet<BenchmarkResponse>(`/api/benchmark${buildQuery({ fiscal_year: year || undefined })}`),
  );
  const benchmark = state.data;
  const series = benchmark?.series ?? [];
  const years = benchmark?.fiscal_years ?? [];
  const source = benchmark?.source;

  const pnfcState = useApi(`benchmark:pnfc:${year || 'latest'}`, () =>
    apiGet<PnfcBenchmarkResponse>(
      `/api/benchmark/pnfc${buildQuery({ fiscal_year: year || undefined })}`,
    ),
  );
  const pnfc = pnfcState.data;
  const pnfcSeries = pnfc?.series ?? [];

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        ABS GFS benchmark
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Official ABS Government Finance Statistics (GFS) COFOG-A expense aggregates for the general
        government sector, by level of government. This is a{' '}
        <strong>top-down statistical benchmark</strong>, not a sum of projects. It is kept separate
        from the project, contract and charity data. The page also shows the ABS GFS Public
        Non-Financial Corporations (PNFC) sector aggregate, which is a separate sector benchmark and
        is never added to any other population.
      </Typography>

      <Alert severity="warning" data-testid="benchmark-caveat" sx={{ mb: 3 }}>
        <AlertTitle>Benchmark only — never add this to project data</AlertTitle>
        {source?.caveat ??
          'ABS GFS is a top-down statistical aggregate. It is a benchmark, not a sum of projects, and must never be added to project data or summed across levels of government or measure types.'}{' '}
        This page shows published ABS cells only; it does not calculate a combined total.
      </Alert>

      {benchmark && source ? (
        <Card variant="outlined" sx={{ mb: 3 }} data-testid="benchmark-source">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6" component="h2">
                {source.dataset}
              </Typography>
              <VerifiedBadge verified />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Published unit: <code>{source.unit}</code>; stored as integer cents at{' '}
              <code>×{source.unit_to_cents.toLocaleString('en-AU')}</code> per unit. Fiscal year{' '}
              {benchmark.source.fiscal_year ?? 'latest'}. Source file:{' '}
              <SourceLink
                sourceId={source.source_id}
                sourceUrl={source.source_url}
                label={source.source_url}
              />
              . Catalogue:{' '}
              <Link href={source.catalogue_url} target="_blank" rel="noopener noreferrer">
                ABS GFS Annual release
              </Link>
              .
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              The ABS SDMX API has no GFS/COFOG dataflow, so the official annual XLSX Key Tables
              9/10 are used (SHA-256 archived outside the repo). The ingested rows are official
              aggregates with <code>verified: true</code> and{' '}
              <code>aggregation_role: benchmark</code>.
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      {years.length > 1 ? (
        <FormControl size="small" sx={{ minWidth: 200, mb: 2 }}>
          <InputLabel id="benchmark-year-label">Financial year</InputLabel>
          <Select
            labelId="benchmark-year-label"
            label="Financial year"
            value={year || benchmark?.source.fiscal_year || ''}
            onChange={(event) => setYear(event.target.value)}
          >
            {years.map((entry) => (
              <MenuItem key={entry} value={entry}>
                {entry}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}

      {state.loading ? <LoadingState label="Loading ABS GFS benchmark…" /> : null}
      {state.error ? (
        <ApiErrorState
          error={state.error}
          hint="The benchmark endpoint needs an API process connected to the database."
        />
      ) : null}

      {!state.loading && !state.error ? (
        series.length === 0 ? (
          <EmptyState
            title="No ABS GFS benchmark rows"
            message="Run npm run ingest:phase4 to load the official ABS GFS Annual 2024-25 Key Tables 9/10 COFOG-A aggregates."
          />
        ) : (
          <>
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  COFOG-A expenses by level of government
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {benchmark?.note}
                </Typography>
                <TableContainer>
                  <Table
                    size="small"
                    aria-label="ABS GFS COFOG-A benchmark series"
                    data-testid="benchmark-series"
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Function</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell>Jurisdiction</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Verification</TableCell>
                        <TableCell>Source</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {series.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {entry.function_code} — {entry.function_name}
                          </TableCell>
                          <TableCell>
                            {LEVEL_LABELS[entry.jurisdiction_level] ?? entry.jurisdiction_level}
                          </TableCell>
                          <TableCell>
                            {entry.jurisdiction === 'Australia'
                              ? 'Australia'
                              : `${entry.jurisdiction} — ${entry.jurisdiction_name}`}
                          </TableCell>
                          <TableCell align="right">
                            <Amount cents={entry.amount_cents} />
                          </TableCell>
                          <TableCell>
                            <VerifiedBadge verified={entry.verified} />
                          </TableCell>
                          <TableCell>
                            <SourceLink sourceId={entry.source_id} sourceUrl={entry.source_url} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <ProvenanceFooter
                  sources={[
                    {
                      source_id: benchmark!.source.source_id,
                      source_url: benchmark!.source.source_url,
                      verified: true,
                      notes: benchmark!.source.caveat,
                    },
                  ]}
                  note={`${series.length} published ABS aggregate cells. No total is computed or displayed.`}
                />
              </CardContent>
            </Card>

            <Card variant="outlined" data-testid="benchmark-project-separation">
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  Project data is a separate population
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  AusTender contracts, PBS budget line items, state budget/project rows and charity
                  expenses are <strong>not</strong> added to these GFS benchmark cells, and GFS is
                  never added to them. Explore those rows on the{' '}
                  <Link component={RouterLink} to="/search">
                    spending explorer
                  </Link>
                  . That page keeps its own measure types and never shows a GFS benchmark total.
                </Typography>
              </CardContent>
            </Card>
          </>
        )
      ) : null}

      <Box id="pnfc" sx={{ mt: 4, scrollMarginTop: '88px' }}>
        <Typography variant="h2" gutterBottom>
          ABS GFS PNFC sector aggregate
        </Typography>
        <Alert severity="warning" data-testid="pnfc-benchmark-caveat" sx={{ mb: 3 }}>
          <AlertTitle>Sector aggregate — never add to project/entity data</AlertTitle>
          {pnfc?.source.caveat ??
            'ABS GFS Public Non-Financial Corporations is a top-down sector aggregate. Never add it to SOC/entity, government, charity or project data, and never sum across jurisdictions or revenue/expense flows.'}{' '}
          This page shows published ABS cells only; it does not calculate a combined total.
        </Alert>

        {pnfc && pnfc.source ? (
          <Card variant="outlined" sx={{ mb: 3 }} data-testid="pnfc-benchmark-source">
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6" component="h2">
                  {pnfc.source.dataset}
                </Typography>
                <VerifiedBadge verified />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Published unit: <code>{pnfc.source.unit}</code>; stored as integer cents at{' '}
                <code>×{pnfc.source.unit_to_cents.toLocaleString('en-AU')}</code> per unit. Fiscal
                year {pnfc.source.fiscal_year ?? 'latest'}. Source release:{' '}
                <Link href={pnfc.source.source_url} target="_blank" rel="noopener noreferrer">
                  ABS GFS Annual release
                </Link>
                . Nine official PNFC data cubes (Australia all levels plus the eight
                states/territories) are SHA-256 archived outside the repo. The ABS SDMX API has no
                PNFC/GFS dataflow, so the official XLSX is the approved fallback.
              </Typography>
            </CardContent>
          </Card>
        ) : null}

        {pnfcState.loading ? <LoadingState label="Loading ABS GFS PNFC benchmark…" /> : null}
        {pnfcState.error ? (
          <ApiErrorState
            error={pnfcState.error}
            hint="The PNFC benchmark endpoint needs an API process connected to the database."
          />
        ) : null}

        {!pnfcState.loading && !pnfcState.error ? (
          pnfcSeries.length === 0 ? (
            <EmptyState
              title="No ABS GFS PNFC benchmark rows"
              message="Run npm run ingest:soc to load the official ABS GFS Annual 2024-25 PNFC data cubes."
            />
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  Published PNFC revenue and expense totals
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {pnfc?.note}
                </Typography>
                <TableContainer>
                  <Table
                    size="small"
                    aria-label="ABS GFS PNFC benchmark series"
                    data-testid="pnfc-benchmark-series"
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Flow</TableCell>
                        <TableCell>Published line</TableCell>
                        <TableCell>Jurisdiction</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Verification</TableCell>
                        <TableCell>Source</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pnfcSeries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell sx={{ textTransform: 'capitalize' }}>
                            {entry.gfs_flow ?? '—'}
                          </TableCell>
                          <TableCell>
                            {entry.gfs_line_label ?? entry.gfs_line_item ?? '—'}
                          </TableCell>
                          <TableCell>
                            {entry.jurisdiction === 'Australia'
                              ? 'Australia (all levels)'
                              : `${entry.jurisdiction} — ${entry.jurisdiction_name}`}
                          </TableCell>
                          <TableCell align="right">
                            <Amount cents={entry.amount_cents} />
                          </TableCell>
                          <TableCell>
                            <VerifiedBadge verified={entry.verified} />
                          </TableCell>
                          <TableCell>
                            <SourceLink sourceId={entry.source_id} sourceUrl={entry.source_url} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <ProvenanceFooter
                  sources={[
                    {
                      source_id: pnfc!.source.source_id,
                      source_url: pnfc!.source.source_url,
                      verified: true,
                      notes: pnfc!.source.caveat,
                    },
                  ]}
                  note={`${pnfcSeries.length} published ABS PNFC aggregate cells. No total is computed or displayed. Sector aggregate — never add to project/entity data.`}
                />
              </CardContent>
            </Card>
          )
        ) : null}
      </Box>
    </Box>
  );
}
