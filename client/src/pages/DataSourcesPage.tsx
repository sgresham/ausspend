import { useEffect } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet } from '../api';
import type { DataSourcesResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useCoverage } from '../coverage';
import { formatDate } from '../format';
import { ProvenanceFooter, SourceLink, VerifiedBadge } from '../components/Provenance';
import { GRANTCONNECT_CAVEAT, PBS_CAVEAT } from '../provenance';
import { ApiErrorState, EmptyState, LoadingState } from '../components/StatusViews';

const AT_A_GLANCE = [
  {
    title: 'Live federal sources',
    body: 'AusTender contracts (F2) and data.gov.au PBS budget line items (F3) are live, with ingested records and last-ingested times on each card. GrantConnect is a manual, SHA-256-archived export — not an API and no live scraper.',
  },
  {
    title: 'State and territory sources',
    body: 'NSW Budget 2025-26 (Budgeted rows only), targeted data.nsw.gov.au CKAN, and the VIC and QLD Phase 4 sources are live. PDF/DOCX resources are listed but deliberately deferred.',
  },
  {
    title: 'Local council coverage',
    body: 'Dubbo Regional Council only (dubbo-council). Its adopted 2026/27 budget PDF is SHA-256 archived; every local row is provisional and unverified. No other council is covered.',
  },
  {
    title: 'Charity',
    body: 'The ACNC Annual Information Statement adds charity-expense rows — expenses only, never government spending.',
  },
  {
    title: 'Benchmarks',
    body: 'ABS GFS COFOG-A and PNFC are official top-down benchmarks. They are never summed with project or entity data, and PNFC revenue and expense are separate flows.',
  },
  {
    title: 'Entity-level statements',
    body: 'State-owned entities from NSW, QLD and WA are shown separately: NSW SOCs, QLD government-owned corporations (GOCs) and WA government trading enterprises (GTEs). Each population is entity-level and is never summed with other data; rows are provisional and unverified. Methodology and caveats below.',
  },
];

const SOC_ENTITIES = [
  {
    name: 'Sydney Water Corporation',
    notes: [
      'Entity-level statement lines parsed from the latest annual report discovered on its official annual-report page; rows are provisional and unverified.',
    ],
  },
  {
    name: 'WaterNSW (Water NSW)',
    notes: [
      'Explicit printed Total expenses accepted only when the printed components and profit bridges reconcile exactly.',
    ],
  },
  {
    name: 'Hunter Water Corporation',
    notes: [
      'Explicit printed Total expenses accepted only when the printed components and profit bridges reconcile exactly.',
      'Its one-dollar printed tax/NPAT rounding is retained only as the printed net result and flagged for human spot-check.',
    ],
  },
  {
    name: 'Essential Energy',
    notes: [
      'Prints in $M and has no single Total expenses subtotal, so total expenses is the exact sum of the printed expense lines, accepted only when every revenue, expense-component and profit bridge reconciles exactly.',
      'Its printed loss is stored with a negative sign; two lines are flagged for human spot-check.',
    ],
  },
  {
    name: 'Forestry Corporation of NSW',
    notes: [
      'Prints in $’000 with an explicit printed Total expenses, accepted only when its four expense lines, Note 5/8/9/10 subtotals and profit bridges reconcile exactly.',
      'Its two government-grant lines are flagged potential double count; two lines are flagged for human spot-check.',
    ],
  },
  {
    name: 'Landcom',
    notes: [
      'Prints in $’000 with no printed Total revenue or Total expenses subtotal, so both are the exact signed sums of the printed statement lines, accepted only when its gross-profit, profit-before-tax, net-result and Note 2.2/2.3/2.4/2.5/2.6 bridges reconcile exactly.',
      'Its grant-income line is flagged potential double count; two lines are flagged for human spot-check.',
    ],
  },
  {
    name: 'Port Authority of NSW',
    notes: [
      'Prints in $’000 with explicit printed Total revenue and Total expenses, accepted only when its revenue and expense lines, profit-before-tax bridge (including net gain on sale of PPE and other gains), net-result bridge and Note 3/Note 4 totals reconcile exactly.',
      'It discloses no separate government grants, so no grant row is emitted; two lines are flagged for human spot-check.',
    ],
  },
  {
    name: 'TAHE (Transport Asset Holding Entity of New South Wales)',
    notes: [
      'Prints in $’000 with explicit printed Total revenue and Total expenses, accepted only when its five revenue lines, five non-nil expense lines plus an explicitly printed nil valuation decrement and the net-result bridge reconcile exactly.',
      'Its separately disclosed Grants and contributions line is flagged potential double count; two lines are flagged for human spot-check.',
    ],
  },
  {
    name: 'Sydney Trains',
    notes: [
      'Prints in $’000 with explicit printed Total revenue and Total expenses excluding losses, accepted only when its four revenue lines, six expense lines, deficit-before-grants, operations-result and net-result bridges (including the below-the-line gains/losses) reconcile exactly.',
      'Its separately disclosed Grants and contributions line is flagged potential double count; two lines are flagged for human spot-check.',
      'The published Volume 2 PDF’s “Draft” footer is recorded as a provenance caveat.',
    ],
  },
  {
    name: 'NSW TrainLink',
    notes: [
      'Prints in $’000 with explicit printed Total revenue and Total expenses excluding losses, accepted only when its three revenue lines, five expense lines, deficit-before-grants, operations-result and net-result bridges (including an explicitly printed nil impairment dash) reconcile exactly.',
      'Its separately disclosed Grants and contributions line is flagged potential double count; two lines are flagged for human spot-check.',
      'The report’s NSW TrainLink brand over the legal entity NSW Trains is recorded as a provenance caveat.',
    ],
  },
];

const SOURCE_COVERAGE_NOTES = [
  {
    heading: 'Federal sources',
    notes: [
      'AusTender is a live federal source as of F2, and data.gov.au PBS budget line items are live as of F3; their ingested records and last-ingested times appear on each source card with provenance.',
      'GrantConnect is a manual, SHA-256-archived DownloadResult XLSX import (chunked and cap-safe): it is not an API and no scraper is built. Wide exports above the 50,000-result cap are rejected, so coverage is reported as partial until complete date-range chunks cover the period.',
    ],
  },
  {
    heading: 'NSW and local sources',
    notes: [
      'NSW Budget 2025-26 Open Data is live as of S1 (official Wayback XLSX copy plus the ArcGIS capital projects layer); its rows are Budgeted, never actual/spent.',
      'Targeted data.nsw.gov.au CKAN ingestion is live as of S2: selected CSV/XLSX and DataStore datasets only, with SHA-256 archived copies. PDF/DOCX resources are deliberately deferred and listed on that source — they are not ingested.',
      'S3 adds exactly one local council, Dubbo Regional Council (dubbo-council): its adopted 2026/27 budget PDF is archived with SHA-256 and every local row is provisional and unverified. No other council is covered.',
    ],
  },
  {
    heading: 'State, territory and WA budget sources',
    notes: [
      'VIC and QLD are live as of Phase 4.',
      'WA Budget EFO tables are live from catalogue.data.wa.gov.au CKAN: no machine-readable BP2 agency-expense dataset is published, so Chapter 5 major spending changes are provisional and Chapter 6 asset investment is reconciled to its printed Total.',
    ],
  },
  {
    heading: 'Charity and benchmarks',
    notes: [
      'The ACNC Annual Information Statement adds charity-expense rows (expenses only, never government spending).',
      'ABS GFS Annual 2024-25 adds official COFOG-A expense aggregates by level of government from the Annual XLSX (the ABS SDMX API has no GFS/COFOG dataflow); they are row-level verified top-down benchmarks and are never summed with project data.',
      'ABS GFS Public Non-Financial Corporations (PNFC) adds a separate sector benchmark from nine official annual XLSX data cubes (Australia all levels plus the eight states/territories); it is a sector aggregate — never add it to project/entity data, and revenue and expense are separate flows.',
    ],
  },
  {
    heading: 'Register-wide rule',
    notes: ['No grant row is estimated or zero-filled.'],
  },
];

const CONNECTOR_NOTES = [
  'aus-tender is live from the AusTender OCDS contractPublished feed; data-gov-au-pbs is live from the data.gov.au CKAN PBS CSV.',
  'nsw-budget is live from the NSW 2025-26 open-data XLSX snapshot plus ArcGIS capital projects; data-nsw-ckan is live from selected data.nsw.gov.au CKAN CSV/XLSX/DataStore resources.',
  'dubbo-council is live for one local council only (Dubbo Regional Council). No other local council set is covered.',
  'aihw-health-expenditure is live from the official data.gov.au CKAN CSV (METEOR is metadata-only): its real/constant-price government and non-government series are non-additive.',
  'wa-budget is live from catalogue.data.wa.gov.au CKAN EFO tables (provisional, no BP2 machine-readable agency detail; no COFOG invented).',
  'tas-budget is live from Budget Paper No. 1 Table 9.16: COFOG-A expenses reconciled to the printed total, provisional and non-additive.',
  'qld-local-government is live from the QLD comparative-information Financial Inputs CSV: council-level actual $’000 inputs, separate from QGIP and never summed across councils or measures.',
  'grantconnect is blocked pending a usable adaptor (no public award API; no direct scraper), and the remaining registered federal connectors are stubs. No other local council set is covered.',
];

function SectionList({ items }: { items: string[] }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {items.map((item) => (
        <Typography
          component="li"
          variant="body2"
          key={item}
          sx={{ lineHeight: 1.6, '& + &': { mt: 1 } }}
        >
          {item}
        </Typography>
      ))}
    </Box>
  );
}

export function DataSourcesPage() {
  const state = useApi('data-sources', () => apiGet<DataSourcesResponse>('/api/data-sources'));
  const coverage = useCoverage();
  const sources = state.data?.sources ?? [];
  const connectors = coverage.data?.connectors ?? [];

  // The page's source cards render after the API responds, so the browser's
  // initial hash scroll happens too early. Re-apply the anchor once loaded.
  useEffect(() => {
    if (!state.data) return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const target = document.getElementById(hash);
    if (target) target.scrollIntoView({ block: 'start' });
  }, [state.data]);

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Data sources
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 4, maxWidth: '78ch', lineHeight: 1.6 }}
      >
        The registered sources behind every figure. Where present, the synthetic development seed
        is explicitly unverified and <code>#synthetic-seed</code> resolves to it; when retired, the
        register lists only real sources. Live federal, state and local data sit alongside
        benchmarks and entity-level statements that are never added together. Scan the At-a-glance
        summary for coverage, then open a source card, methodology note or connector note for
        caveats and provenance.
      </Typography>

      <Typography variant="h5" component="h2" gutterBottom>
        At a glance
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        {AT_A_GLANCE.map((item) => (
          <Card key={item.title} variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                {item.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {item.body}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Divider sx={{ mt: 4 }} />

      <Typography variant="h5" component="h2" sx={{ mt: 4 }} gutterBottom>
        Registered sources
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: '78ch' }}>
        Every registered source is listed below with its source ID, status, provenance and links.
        Use a source ID anchor (for example <code>#synthetic-seed</code>) to link directly to a
        card.
      </Typography>

      <Alert severity="warning" data-testid="pbs-caveat" sx={{ mb: 2 }}>
        <strong>PBS budget caveat.</strong> {PBS_CAVEAT}
      </Alert>

      <Alert severity="info" data-testid="qgip-coverage-caveat" sx={{ mb: 3 }}>
        <strong>QLD QGIP coverage.</strong> QLD QGIP grant/contract payment-level rows cover 2018-19
        through 2024-25. 2019-20 is partial because the publisher left annual expenditure blank on
        most rows (a source gap, not a spending fall). QGIP grants and contracts are never summed,
        and the data are provisional and unverified.
      </Alert>

      {state.loading ? <LoadingState label="Loading source register…" /> : null}
      {state.error ? <ApiErrorState error={state.error} /> : null}

      {!state.loading && !state.error ? (
        sources.length === 0 ? (
          <EmptyState title="No sources registered" message="The source register is empty." />
        ) : (
          <Stack spacing={2}>
            {sources.map((source) => (
              <Card
                key={source.source_id}
                id={source.source_id}
                variant="outlined"
                data-testid={`source-${source.source_id}`}
                sx={{ scrollMarginTop: '88px' }}
              >
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="h6" component="h3">
                      {source.name}
                    </Typography>
                    <VerifiedBadge verified={source.verified} />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`source_id: ${source.source_id}`}
                    />
                  </Stack>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '140px 1fr' },
                      columnGap: 2,
                      rowGap: 0.5,
                      mt: 2,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Publisher
                    </Typography>
                    <Typography variant="body2">{source.publisher}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Licence
                    </Typography>
                    <Typography variant="body2">{source.license}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Retrieved
                    </Typography>
                    <Typography variant="body2">{formatDate(source.retrieved_at)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Source URL
                    </Typography>
                    <Typography variant="body2">
                      <SourceLink
                        sourceId={source.source_id}
                        sourceUrl={source.source_url}
                        label={source.source_url}
                      />
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Verification
                    </Typography>
                    <Typography variant="body2">
                      {source.verified
                        ? 'Verified source'
                        : source.source_id === 'synthetic-seed'
                          ? 'Unverified — not a published government figure'
                          : 'Unverified — source link not human-checked'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ingestion status
                    </Typography>
                    <Typography
                      variant="body2"
                      data-testid={`ingestion-status-${source.source_id}`}
                    >
                      {source.status} · {source.records_ingested} record(s)
                      {source.last_ingested_at
                        ? ` · last ingested ${formatDate(source.last_ingested_at)}`
                        : ' · never ingested'}
                      {source.fetch_strategy ? ` · fetch strategy ${source.fetch_strategy}` : ''}
                    </Typography>
                  </Box>

                  {source.status === 'degraded' || (source.staleness_days ?? 0) > 0 ? (
                    <Alert
                      severity="warning"
                      data-testid={`stale-${source.source_id}`}
                      sx={{ mt: 2 }}
                    >
                      <strong>Stale data — the last successful fetch is still shown.</strong>{' '}
                      {source.last_successful_fetch
                        ? `Last successful fetch ${formatDate(source.last_successful_fetch)}${
                            typeof source.staleness_days === 'number'
                              ? ` (${source.staleness_days} day${
                                  source.staleness_days === 1 ? '' : 's'
                                } ago)`
                              : ''
                          }.`
                        : 'No successful fetch is recorded.'}{' '}
                      The {source.records_ingested} existing record(s) are preserved and displayed
                      unchanged; a failed refresh never deletes, zero-fills or hides them.
                      {source.fetch_strategy
                        ? ` The last successful document was obtained via ${source.fetch_strategy}.`
                        : ''}
                    </Alert>
                  ) : null}

                  {source.notes ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      {source.notes}
                    </Typography>
                  ) : null}

                  {source.source_id === 'abs-gfs' ? (
                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      Official ABS GFS COFOG-A aggregates have row-level{' '}
                      <strong>verified: true</strong> and <code>aggregation_role: benchmark</code>.
                      They are a top-down benchmark, not project data.{' '}
                      <Link component={RouterLink} to="/benchmark">
                        Open the ABS GFS benchmark view →
                      </Link>
                    </Typography>
                  ) : null}

                  {source.source_id === 'abs-gfs-pnfc' ? (
                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      ABS GFS Public Non-Financial Corporations is a{' '}
                      <strong>sector aggregate — never add to project/entity data</strong>. Every
                      row is a published official aggregate with <strong>verified: true</strong>,{' '}
                      <code>jurisdiction_level: pnfc</code> and{' '}
                      <code>aggregation_role: benchmark</code>. Revenue and expense are separate
                      flows and are never summed.{' '}
                      <Link component={RouterLink} to="/benchmark#pnfc">
                        Open the PNFC benchmark view →
                      </Link>
                    </Typography>
                  ) : null}

                  {source.source_id === 'aus-tender' ? (
                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      <Link
                        component={RouterLink}
                        to="/search?measure_type=contract&jurisdiction_level=federal"
                      >
                        Browse ingested AusTender contracts with provenance →
                      </Link>
                    </Typography>
                  ) : null}

                  {source.source_id === 'data-gov-au-pbs' ? (
                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      <Link
                        component={RouterLink}
                        to="/search?measure_type=budget&jurisdiction_level=federal"
                      >
                        Browse ingested PBS budget line items with provenance →
                      </Link>
                    </Typography>
                  ) : null}

                  {source.source_id === 'nsw-budget' ? (
                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      <Link component={RouterLink} to="/search?jurisdiction_level=state">
                        Browse NSW Budgeted state rows with provenance →
                      </Link>
                    </Typography>
                  ) : null}

                  {source.source_id === 'data-nsw-ckan' ? (
                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      <Link component={RouterLink} to="/search?jurisdiction_level=state">
                        Browse targeted data.nsw.gov.au CKAN state rows with provenance →
                      </Link>
                    </Typography>
                  ) : null}
                  {source.source_id === 'vic-budget' ? (
                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      <Link component={RouterLink} to="/states/VIC">
                        Open the VIC Budget 2026-27 state page (COFOG-A budget rows) →
                      </Link>
                    </Typography>
                  ) : null}
                  {source.source_id === 'qld-budget' ? (
                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      <Link component={RouterLink} to="/states/QLD">
                        Open the QLD Budget 2026-27 state page (BP3/BP4 budget rows) →
                      </Link>
                    </Typography>
                  ) : null}
                  {source.source_id === 'acnc-charity' ? (
                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      <Link
                        component={RouterLink}
                        to="/search?jurisdiction_level=charity&expense_category=total"
                      >
                        Browse ACNC charity total expenses with provenance →
                      </Link>
                      {' · '}
                      <Link component={RouterLink} to="/search?jurisdiction_level=charity">
                        Browse all charity total + component rows →
                      </Link>
                    </Typography>
                  ) : null}
                  {source.source_id === 'qld-qgip' ? (
                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      <Link
                        component={RouterLink}
                        to="/search?measure_type=grant_award&jurisdiction_level=state"
                      >
                        Browse QLD QGIP grant_award rows with provenance →
                      </Link>
                      {' · '}
                      <Link
                        component={RouterLink}
                        to="/search?measure_type=contract&jurisdiction_level=state"
                      >
                        Browse QLD QGIP contract rows →
                      </Link>
                    </Typography>
                  ) : null}

                  {source.source_id === 'dubbo-council' ? (
                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      <Link component={RouterLink} to="/areas/dubbo">
                        Open the Dubbo area profile (local + NSW-wide + NSW-tagged federal + PBS) →
                      </Link>
                    </Typography>
                  ) : null}

                  {source.source_id === 'grantconnect' ? (
                    <>
                      <Alert
                        severity="warning"
                        data-testid="grantconnect-manual-caveat"
                        sx={{ mt: 2 }}
                      >
                        <strong>Manual export — not an API or scraper.</strong>{' '}
                        {GRANTCONNECT_CAVEAT}
                      </Alert>
                      <Typography variant="body2" sx={{ mt: 1.5 }}>
                        <Link
                          component={RouterLink}
                          to="/search?measure_type=grant_award&jurisdiction_level=federal"
                        >
                          Browse ingested grant awards with provenance →
                        </Link>
                      </Typography>
                    </>
                  ) : null}

                  {source.deferred_resources && source.deferred_resources.length > 0 ? (
                    <Alert
                      severity="info"
                      data-testid={`deferred-${source.source_id}`}
                      sx={{ mt: 2 }}
                    >
                      <Typography variant="subtitle2">
                        Deferred resources — recorded, not ingested
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        PDF/DOC/DOCX extraction belongs to the separate PDF foundation. These
                        resources are intentionally skipped in S2 and remain visible for later
                        manual review.
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                        {source.deferred_resources.map((resource) => (
                          <Typography
                            component="li"
                            variant="body2"
                            key={`${resource.resource_id}-${resource.format}`}
                          >
                            <strong>{resource.format}</strong> · {resource.dataset_title} —{' '}
                            <Link href={resource.url} target="_blank" rel="noreferrer">
                              {resource.name}
                            </Link>
                            <br />
                            <span>{resource.reason}</span>
                          </Typography>
                        ))}
                      </Box>
                    </Alert>
                  ) : null}

                  <ProvenanceFooter
                    sources={[source]}
                    note="Every measure row in the API repeats this source reference."
                  />
                </CardContent>
              </Card>
            ))}
          </Stack>
        )
      ) : null}

      <Accordion
        disableGutters
        data-testid="entity-methodology"
        sx={{ mt: 4, border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography variant="h6" component="h2">
              Entity-level statements — methodology and caveats
            </Typography>
            <Typography variant="body2" color="text.secondary">
              NSW SOC methodology and caveats. QLD GOC and WA GTE source-specific caveats are
              recorded on their source cards.
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ mb: 2, maxWidth: '80ch', lineHeight: 1.6 }}>
            For the NSW SOC entities below, each latest annual report is discovered from the
            entity’s official annual-report page (no hard-coded PDF URL), SHA-256 archived outside
            the repo, and parsed as entity-level statement lines (
            <code>jurisdiction_level: soc</code>, <code>aggregation_role: agency_detail</code>) with
            an explicit printed unit (for example $’000 for Forestry Corporation, $M for Essential
            Energy) or the entity’s own explicit unit.
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, maxWidth: '80ch', lineHeight: 1.6 }}
          >
            Coverage note: this list is the NSW SOC population only. QLD GOC and WA GTE entities
            are separate legal populations, never summed with NSW SOC rows or each other, and their
            source-specific caveats are recorded on their source cards and the live register.
          </Typography>
          <Stack spacing={2} divider={<Divider flexItem />}>
            {SOC_ENTITIES.map((entity) => (
              <Box key={entity.name}>
                <Typography variant="h6" component="h3" gutterBottom>
                  {entity.name}
                </Typography>
                <SectionList items={entity.notes} />
              </Box>
            ))}
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 2, maxWidth: '80ch', lineHeight: 1.6 }}
          >
            All rows are provisional and unverified; government-named funding rows carry a
            potential-double-count warning. State-owned entity rows are never added to government
            program spending, the PNFC benchmark, another entity or each other, and are exposed
            only at <code>/api/soc</code> with separate entity/source badges.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion
        disableGutters
        data-testid="source-coverage-notes"
        sx={{ mt: 2, border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" component="h2">
            Source coverage and benchmark notes
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2} divider={<Divider flexItem />}>
            {SOURCE_COVERAGE_NOTES.map((group) => (
              <Box key={group.heading}>
                <Typography variant="h6" component="h3" gutterBottom>
                  {group.heading}
                </Typography>
                <SectionList items={group.notes} />
              </Box>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ mt: 4 }} />

      <Typography variant="h5" component="h2" sx={{ mt: 4 }} gutterBottom>
        Ingestion connectors
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2, maxWidth: '78ch', lineHeight: 1.6 }}
      >
        {connectors.length} connectors are registered. A <strong>stub</strong> makes no network call
        and ingests no records; an <strong>active</strong> connector has ingested, and a{' '}
        <strong>degraded</strong> connector reports errors. Live connector sources and long coverage
        caveats are grouped in the expandable notes below.
      </Typography>

      <Accordion
        disableGutters
        data-testid="connector-coverage-notes"
        sx={{ mb: 2, border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" component="h3">
            Connector coverage notes
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <SectionList items={CONNECTOR_NOTES} />
        </AccordionDetails>
      </Accordion>

      {!coverage.data && coverage.error ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Connector metadata could not be loaded from <code>/api/meta/coverage</code> (
          {coverage.error.message}). No connector is claimed to be operational.
        </Alert>
      ) : null}

      {coverage.data ? (
        <Card variant="outlined" data-testid="connector-stubs">
          <CardContent>
            <Stack divider={<Divider flexItem />} spacing={2}>
              {connectors.map((connector) => (
                <Box key={connector.id}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle1">{connector.name}</Typography>
                    <Chip size="small" variant="outlined" label={connector.id} />
                    <Chip
                      size="small"
                      color="default"
                      variant="outlined"
                      label={connector.status === 'stub' ? 'stub — not wired' : connector.status}
                    />
                    <Chip size="small" variant="outlined" label={connector.jurisdiction_level} />
                    {connector.fetch_strategy ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        data-testid={`fetch-strategy-${connector.id}`}
                        label={`fetch: ${connector.fetch_strategy}`}
                      />
                    ) : null}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {connector.publisher} · {connector.records_ingested} record(s)
                    {connector.last_fetched_at
                      ? ` · last fetched ${formatDate(connector.last_fetched_at)}`
                      : ' · never fetched'}
                    {typeof connector.staleness_days === 'number'
                      ? ` · ${connector.staleness_days} day${
                          connector.staleness_days === 1 ? '' : 's'
                        } stale`
                      : ''}
                  </Typography>
                  <Typography variant="body2" component="div">
                    <SourceLink
                      sourceId={connector.id}
                      sourceUrl={connector.source_url}
                      label={connector.source_url}
                    />
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
        The full coverage limitations and provenance caveats are listed on the{' '}
        <Link component={RouterLink} to="/coverage-limitations">
          coverage limitations page
        </Link>
        .
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        Licence, copyright and attribution rules — including sources that are not CC BY — are
        explained in the{' '}
        <Link component={RouterLink} to="/legal#copyright">
          legal, copyright and privacy notices
        </Link>
        .
      </Typography>
    </Box>
  );
}
