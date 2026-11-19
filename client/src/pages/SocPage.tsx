import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
 * Entity-level SOC view (NSW SOCs and the QLD Energy Queensland/CS Energy/Stanwell/Powerlink/Sunwater/Gladstone Ports/Port of Townsville/Ports North pilots). These
 * are state-owned corporations' own published financial-statement lines, not
 * project spending and not the PNFC sector benchmark. Every entity is separate
 * and NSW and QLD entities are different legal populations; they are never
 * combined. The page deliberately computes no total: statement lines overlap
 * each other and government program spending.
 */
export function SocPage() {
  const [year, setYear] = useState<string>('');
  const [searchParams, setSearchParams] = useSearchParams();
  const entity = searchParams.get('entity') ?? '';
  const setEntity = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set('entity', next);
    else params.delete('entity');
    setSearchParams(params, { replace: true });
  };
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

  // Group rows by printed note/table so the WaterNSW note breakdown is visible
  // as an expandable hierarchy instead of being buried under the face rows.
  // Every group is still non-additive: no group total is computed.
  const groupOrder: Record<string, number> = {
    'Face statement': 0,
    'Note 2 Revenue from water supply and delivery': 1,
    'Note 3 Grants and subsidies': 2,
    'Note 4 Other revenue': 3,
    'Note 5 Employee related expenses': 4,
    'Note 6 Other operating expenses': 5,
    'Note 7 Depreciation and amortisation': 6,
    'Note 8 Finance costs': 7,
    'Statement of cash flows — investing activities': 8,
  };
  const groups = (() => {
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.soc_note ?? 'Face statement';
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return [...map.entries()].sort((a, b) => {
      const rank = (groupOrder[a[0]] ?? 99) - (groupOrder[b[0]] ?? 99);
      return rank !== 0 ? rank : a[0].localeCompare(b[0]);
    });
  })();

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        SOC entities
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Entity-level financial-statement lines for Australian state-owned corporations. The layer
        currently covers New South Wales SOCs and the Queensland pilot entities Energy Queensland,
        CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, Port of Townsville Limited and Ports North (all QLD Government Owned Corporations). This
        is a <strong>separate layer</strong> from Australian government program spending and from
        the ABS GFS Public Non-Financial Corporations (PNFC) sector benchmark. Sydney Water,
        WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW, Landcom, Port
        Authority of NSW, TAHE, Sydney Trains, NSW TrainLink and Energy Queensland, CS Energy,
        Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, Port of Townsville Limited and Ports North are <strong>separate entities</strong>: their rows are
        never added together, and NSW and QLD entities are never combined; Energy Queensland, CS
        Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, Port of Townsville Limited and Ports North are separate QLD GOCs and are never added
        together. Coverage is entity-level only: no project, LGA, SA2 or coordinate is present.
        WaterNSW is shown with its published note-level breakdown (Notes 2, 4, 5, 6, 7, 8 and
        cash-flow capital expenditure), grouped and expandable; each component reconciles to its
        printed note subtotal and is never added to the entity total.
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

      {state.loading ? <LoadingState label="Loading SOC statement lines…" /> : null}
      {state.error ? (
        <ApiErrorState
          error={state.error}
          hint="The SOC endpoint needs an API process connected to the database."
        />
      ) : null}

      {!state.loading && !state.error ? (
        rows.length === 0 ? (
          <EmptyState
            title="No SOC rows"
            message="Run npm run ingest:soc to load the latest annual reports (PNFC first, then Sydney Water, WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW, Landcom, Port Authority of NSW, TAHE, Sydney Trains, NSW TrainLink, and the QLD Energy Queensland, CS Energy, Stanwell, Powerlink, Sunwater, Gladstone Ports, Port of Townsville and Ports North pilots)."
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
              <Box data-testid="soc-series">
                {groups.map(([groupName, groupRows], groupIndex) => {
                  const isFace = groupName === 'Face statement';
                  const section = groupRows[0]?.soc_section ?? null;
                  const componentOf = groupRows[0]?.soc_component_of ?? null;
                  return (
                    <Accordion
                      key={groupName}
                      defaultExpanded={isFace || groupIndex < 3}
                      disableGutters
                      data-testid="soc-group"
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <Typography variant="subtitle1">{groupName}</Typography>
                          {section ? (
                            <Chip size="small" variant="outlined" label={section} />
                          ) : null}
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`${groupRows.length} row${groupRows.length === 1 ? '' : 's'}`}
                          />
                          <Chip
                            size="small"
                            color="default"
                            variant="outlined"
                            label="no total"
                            data-testid="soc-group-no-total"
                          />
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mb: 1 }}
                        >
                          {isFace
                            ? 'Published face-statement lines. They overlap each other: total revenue includes the separately shown grants and total expenses includes employee, depreciation/amortisation and transfer lines.'
                            : `Printed note components of ${componentOf ?? 'the note subtotal'}. They are not additional spending, are never added to the entity total, and the page computes no total.`}
                        </Typography>
                        <TableContainer>
                          <Table
                            size="small"
                            aria-label={`SOC entity statement lines — ${groupName}`}
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
                              {groupRows.map((entry) => (
                                <TableRow key={entry.id}>
                                  <TableCell>{entry.delivery_entity}</TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {entry.soc_line_label ?? entry.soc_line_item}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {entry.soc_line_item}
                                      {entry.soc_component_of
                                        ? ` · component of ${entry.soc_component_of}`
                                        : ''}
                                      {entry.soc_printed_sign === 'negative'
                                        ? ' · printed deduction'
                                        : ''}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>{entry.funding_source ?? '—'}</TableCell>
                                  <TableCell align="right">
                                    {entry.soc_printed_sign === 'negative' ? '−' : ''}
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
                                    <SourceLink
                                      sourceId={entry.source_id}
                                      sourceUrl={entry.source_url}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Box>
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
