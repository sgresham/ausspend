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
import type { SocResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import {
  Amount,
  MeasureTypeChip,
  ProvenanceFooter,
  SourceLink,
  VerifiedBadge,
} from '../components/Provenance';
import { ApiErrorState, EmptyState, LoadingState } from '../components/StatusViews';

/**
 * NSW SOC entity view. These are state-owned corporations' own published
 * financial-statement lines, not project spending and not the PNFC sector
 * benchmark. Sydney Water and WaterNSW are separate entities and are never
 * combined. The page deliberately computes no total: statement lines overlap
 * each other and government program spending.
 */
export function SocPage() {
  const [year, setYear] = useState<string>('');
  const [entity, setEntity] = useState<string>('');
  const state = useApi(`soc:${entity || 'all'}:${year || 'latest'}`, () =>
    apiGet<SocResponse>(
      `/api/soc${buildQuery({
        fiscal_year: year || undefined,
        entity: entity || undefined,
      })}`,
    ),
  );
  const soc = state.data;
  const rows = soc?.series ?? [];
  const years = soc?.fiscal_years ?? [];
  const entities = soc?.entities ?? [];
  const sources = soc?.sources ?? [];
  const source = soc?.source;

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        NSW SOC entities
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Entity-level financial-statement lines for New South Wales State Owned Corporations. This is
        a <strong>separate layer</strong> from Australian government program spending and from the
        ABS GFS Public Non-Financial Corporations (PNFC) sector benchmark. Sydney Water and WaterNSW
        are <strong>separate entities</strong>: their rows are never added together. Coverage is
        entity-level only: no project, LGA, SA2 or coordinate is present.
      </Typography>

      <Alert severity="warning" data-testid="soc-caveat" sx={{ mb: 3 }}>
        <AlertTitle>
          SOC entity statement — never add this to government program spending
        </AlertTitle>
        {source?.caveat ??
          'SOC statement lines overlap each other and government program spending. Never add an SOC row to government data, to the PNFC benchmark, to another SOC entity, or to another SOC line.'}{' '}
        This page shows published rows only; it does not calculate a combined total. Rows flagged
        &quot;potential double count&quot; name a government agency or government contribution.
      </Alert>

      {soc && source ? (
        <Card variant="outlined" sx={{ mb: 3 }} data-testid="soc-source">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6" component="h2">
                {entity ? `${entity} — ` : 'SOC entities — '}
                {source.name}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={`jurisdiction: ${source.jurisdiction}`}
              />
              <Chip size="small" variant="outlined" label="level: SOC entity" />
              <Chip
                size="small"
                variant="outlined"
                label={`unit: ${source.unit_label} (${source.unit})`}
              />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {sources.map((entry) => (
                <Chip
                  key={entry.source_id}
                  size="small"
                  color={entry.records > 0 ? 'primary' : 'default'}
                  variant={entry.records > 0 ? 'filled' : 'outlined'}
                  label={`${entry.entity}: ${entry.records} row${entry.records === 1 ? '' : 's'}`}
                />
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Discovered from the entity&apos;s official annual-report page; the exact PDF and its
              SHA-256 are archived outside the repo. Printed unit <code>{source.unit_label}</code>{' '}
              stored as integer cents at{' '}
              <code>×{source.unit_to_cents.toLocaleString('en-AU')}</code> per unit. Rows are
              provisional and <strong>unverified</strong> until a human spot-check.
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        {entities.length > 1 ? (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="soc-entity-label">SOC entity</InputLabel>
            <Select
              labelId="soc-entity-label"
              label="SOC entity"
              value={entity}
              onChange={(event) => setEntity(event.target.value)}
            >
              <MenuItem value="">All SOC entities</MenuItem>
              {entities.map((entry) => (
                <MenuItem key={entry} value={entry}>
                  {entry}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}
        {years.length > 1 ? (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="soc-year-label">Financial year</InputLabel>
            <Select
              labelId="soc-year-label"
              label="Financial year"
              value={year || soc?.fiscal_years.at(-1) || ''}
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
      </Stack>

      {state.loading ? <LoadingState label="Loading NSW SOC statement lines…" /> : null}
      {state.error ? (
        <ApiErrorState
          error={state.error}
          hint="The SOC endpoint needs an API process connected to the database."
        />
      ) : null}

      {!state.loading && !state.error ? (
        rows.length === 0 ? (
          <EmptyState
            title="No NSW SOC rows"
            message="Run npm run ingest:soc to load the latest annual reports (PNFC first, then Sydney Water and WaterNSW)."
          />
        ) : (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                {entity ? `${entity} statement lines` : 'SOC statement lines'} —{' '}
                {rows[0]?.fiscal_year}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {soc?.note}
              </Typography>
              <TableContainer>
                <Table
                  size="small"
                  aria-label="NSW SOC entity statement lines"
                  data-testid="soc-series"
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Entity</TableCell>
                      <TableCell>Line item</TableCell>
                      <TableCell>Funding source</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Measure</TableCell>
                      <TableCell>Confidence</TableCell>
                      <TableCell>Flags</TableCell>
                      <TableCell>Source</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.delivery_entity}</TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {entry.soc_line_label ?? entry.soc_line_item}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {entry.soc_line_item}
                          </Typography>
                        </TableCell>
                        <TableCell>{entry.funding_source ?? '—'}</TableCell>
                        <TableCell align="right">
                          <Amount cents={entry.amount_cents} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={entry.soc_unit ?? source?.unit ?? 'unit unknown'}
                          />
                        </TableCell>
                        <TableCell>
                          <MeasureTypeChip type={entry.measure_type} />
                        </TableCell>
                        <TableCell>{entry.extraction_confidence ?? '—'}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            <VerifiedBadge verified={entry.verified} />
                            {entry.data_quality_flag ? (
                              <Chip
                                size="small"
                                variant="outlined"
                                color="warning"
                                label={entry.data_quality_flag}
                              />
                            ) : null}
                            {entry.potential_double_count ? (
                              <Chip
                                size="small"
                                color="error"
                                variant="outlined"
                                label="potential double count"
                                data-testid="soc-double-count"
                              />
                            ) : (
                              <Chip size="small" variant="outlined" label="own source" />
                            )}
                          </Stack>
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
                sources={rows.map((entry) => ({
                  source_id: entry.source_id,
                  source_url: entry.source_url,
                  verified: entry.verified,
                  notes: entry.soc_line_label ?? undefined,
                }))}
                note="SOC statement lines are provisional and unverified, and each entity is separate. No total is computed: total revenue includes the separately shown grants and total expenses includes employee, depreciation/amortisation and transfer lines."
              />
            </CardContent>
          </Card>
        )
      ) : null}

      {soc && soc.deferred_documents.length > 0 ? (
        <Card variant="outlined" data-testid="soc-deferred">
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Deferred SOC documents
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Documents that could not be validated (unit or table ambiguity, or a failed total
              reconciliation) are recorded here. No row from a deferred document is ingested.
            </Typography>
            {soc.deferred_documents.map((entry) => (
              <Alert
                key={`${entry.source_id}:${entry.document_url}`}
                severity="info"
                sx={{ mb: 1 }}
              >
                <strong>{entry.title}</strong> ({entry.fiscal_year ?? 'year unknown'}) —{' '}
                {entry.reason}
                <br />
                <Link href={entry.document_url} target="_blank" rel="noopener noreferrer">
                  {entry.document_url}
                </Link>
              </Alert>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
