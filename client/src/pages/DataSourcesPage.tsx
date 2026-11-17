import { useEffect } from 'react';
import {
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
import { Link as RouterLink } from 'react-router-dom';
import { apiGet } from '../api';
import type { DataSourcesResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useCoverage } from '../coverage';
import { formatDate } from '../format';
import { ProvenanceFooter, SourceLink, VerifiedBadge } from '../components/Provenance';
import { GRANTCONNECT_CAVEAT, PBS_CAVEAT } from '../provenance';
import { ApiErrorState, EmptyState, LoadingState } from '../components/StatusViews';

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
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The registered sources behind every figure. When present, the synthetic development seed is
        explicitly unverified and the anchor <code>#synthetic-seed</code> resolves to it below. When
        it has been retired, the register lists only real sources. AusTender is a live federal
        source as of F2 and data.gov.au PBS budget line items are live as of F3 — their ingested
        records and last-ingested times appear here with their provenance. NSW Budget 2025-26 Open
        Data is live as of S1 (official Wayback XLSX copy plus the ArcGIS capital projects layer);
        its rows are Budgeted, never actual/spent. Targeted data.nsw.gov.au CKAN ingestion is live
        as of S2: selected CSV/XLSX and DataStore datasets only, with SHA-256 archived copies.
        PDF/DOCX resources are deliberately deferred and listed on that source — they are not
        ingested. S3 adds exactly one local council, Dubbo Regional Council (
        <code>dubbo-council</code>): its adopted 2026/27 budget PDF is archived with SHA-256 and
        every local row is provisional and unverified. No other council is covered. GrantConnect is
        a manual, SHA-256-archived DownloadResult XLSX import (chunked and cap-safe): it is not an
        API and no scraper is built, and wide exports above the 50,000-result cap are rejected, so
        its coverage is reported as partial until complete date-range chunks cover the period. VIC
        and QLD are live as of Phase 4, and the ACNC Annual Information Statement adds
        charity-expense rows (expenses only, never government spending). ABS GFS Annual 2024-25 adds
        official COFOG-A expense aggregates by level of government from the Annual XLSX (the ABS
        SDMX API has no GFS/COFOG dataflow); they are row-level verified top-down benchmarks and are
        never summed with project data. ABS GFS Public Non-Financial Corporations (PNFC) adds a
        separate sector benchmark from nine official annual XLSX data cubes (Australia all levels
        plus the eight states/territories); it is a sector aggregate — never add it to
        project/entity data, and revenue and expense are separate flows. NSW SOC phases 2–11 add ten
        separate entities: Sydney Water Corporation, WaterNSW (Water NSW), Hunter Water Corporation,
        Essential Energy, Forestry Corporation of NSW, Landcom, Port Authority of NSW, TAHE
        (Transport Asset Holding Entity of New South Wales), Sydney Trains and NSW TrainLink. Each
        latest annual report is discovered from the entity&apos;s official annual-report page (no
        hard-coded PDF URL), SHA-256 archived outside the repo, and parsed as entity-level statement
        lines (<code>jurisdiction_level: soc</code>, <code>aggregation_role: agency_detail</code>)
        with an explicit printed $’000 unit (Forestry Corporation) or the entity’s own explicit
        unit. WaterNSW&apos;s and Hunter Water&apos;s explicit printed Total expenses are accepted
        only when their printed components and profit bridges reconcile exactly; Hunter Water&apos;s
        one-dollar printed tax/NPAT rounding is retained only as the printed net result and flagged
        for human spot-check. Essential Energy prints in $M and has no single Total expenses
        subtotal, so its total expenses is the exact sum of the printed expense lines, accepted only
        when every revenue, expense-component and profit bridge reconciles exactly; its printed loss
        is stored with a negative sign and two lines are flagged for human spot-check. Forestry
        Corporation of NSW prints in $’000 with an explicit printed Total expenses, accepted only
        when its four expense lines, Note 5/8/9/10 subtotals and profit bridges reconcile exactly;
        its two government-grant lines are flagged potential double count and two lines are flagged
        for human spot-check. Landcom prints in $’000 with no printed Total revenue or Total
        expenses subtotal, so both are the exact signed sums of the printed statement lines,
        accepted only when its gross-profit, profit-before-tax, net-result and Note
        2.2/2.3/2.4/2.5/2.6 bridges reconcile exactly; its grant-income line is flagged potential
        double count and two lines are flagged for human spot-check. Port Authority of NSW prints in
        $’000 with explicit printed Total revenue and Total expenses, accepted only when its revenue
        and expense lines, profit-before-tax bridge (including net gain on sale of PPE and other
        gains), net-result bridge and Note 3/Note 4 totals reconcile exactly; it discloses no
        separate government grants, so no grant row is emitted, and two lines are flagged for human
        spot-check. TAHE prints in $’000 with explicit printed Total revenue and Total expenses,
        accepted only when its five revenue lines, five non-nil expense lines plus an explicitly
        printed nil valuation decrement and the net-result bridge reconcile exactly; its separately
        disclosed Grants and contributions line is flagged potential double count and two lines are
        flagged for human spot-check. Sydney Trains prints in $’000 with explicit printed Total
        revenue and Total expenses excluding losses, accepted only when its four revenue lines, six
        expense lines, deficit-before-grants, operations-result and net-result bridges (including
        the below-the-line gains/losses) reconcile exactly; its separately disclosed Grants and
        contributions line is flagged potential double count, two lines are flagged for human
        spot-check, and the published Volume 2 PDF’s “Draft” footer is recorded as a provenance
        caveat. NSW TrainLink prints in $’000 with explicit printed Total revenue and Total expenses
        excluding losses, accepted only when its three revenue lines, five expense lines,
        deficit-before-grants, operations-result and net-result bridges (including an explicitly
        printed nil impairment dash) reconcile exactly; its separately disclosed Grants and
        contributions line is flagged potential double count, two lines are flagged for human
        spot-check, and the report’s NSW TrainLink brand over the legal entity NSW Trains is
        recorded as a provenance caveat. Rows are provisional and unverified; government-named
        funding rows carry a potential-double-count warning. SOC rows are never added to government
        program spending, the PNFC benchmark, another SOC entity or each other, and are exposed only
        at <code>/api/soc</code> with separate entity/source badges. WA remains a stub. No grant row
        is estimated or zero-filled.
      </Typography>

      <Alert severity="warning" data-testid="pbs-caveat" sx={{ mb: 3 }}>
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
                    <Typography variant="h6" component="h2">
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

      <Typography variant="h5" component="h2" sx={{ mt: 4 }} gutterBottom>
        Ingestion connectors
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {connectors.length} connectors are registered. A <strong>stub</strong> makes no network call
        and ingests no records; an <strong>active</strong> connector has ingested, and a{' '}
        <strong>degraded</strong> connector reports errors. <code>aus-tender</code> is live from the
        AusTender OCDS contractPublished feed, <code>data-gov-au-pbs</code> is live from the
        data.gov.au CKAN PBS CSV, <code>nsw-budget</code> is live from the NSW 2025-26 open-data
        XLSX snapshot plus ArcGIS capital projects, and <code>data-nsw-ckan</code> is live from
        selected data.nsw.gov.au CKAN CSV/XLSX/DataStore resources, and <code>dubbo-council</code>
        is live for one local council only (Dubbo Regional Council). <code>grantconnect</code> is
        blocked pending a usable adaptor (no public award API; no direct scraper) and the remaining
        seven connectors (four federal and VIC/QLD/WA) are stubs. No other council is covered.
      </Typography>

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

      <Typography variant="h5" component="h2" sx={{ mt: 4 }} gutterBottom>
        Coverage limitations
      </Typography>
      {coverage.data ? (
        <Card variant="outlined" data-testid="coverage-limitations">
          <CardContent>
            <Box component="ul" sx={{ mt: 0, mb: 2, pl: 2.5 }}>
              {coverage.data.limitations.map((limitation) => (
                <Typography component="li" variant="body2" key={limitation}>
                  {limitation}
                </Typography>
              ))}
            </Box>
            <ProvenanceFooter sources={[]} note={coverage.data.note} />
          </CardContent>
        </Card>
      ) : null}

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
