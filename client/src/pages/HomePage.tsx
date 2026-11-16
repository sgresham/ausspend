import {
  Alert,
  AlertTitle,
  Box,
  Button,
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
import type { DataSourcesResponse, FunctionsResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useCoverage } from '../coverage';
import { formatDate } from '../format';
import { ProvenanceFooter, SourceLink, VerifiedBadge } from '../components/Provenance';
import { QuickSearch } from '../components/QuickSearch';
import { ApiErrorState, LoadingState } from '../components/StatusViews';

const QUICK_LINKS = [
  {
    to: '/search',
    title: 'Spending explorer',
    description:
      'Filter by function, region, year, measure type and amount, then page through rows.',
  },
  {
    to: '/functions',
    title: 'Functions',
    description: 'Browse the ten COFOG divisions and their curated subdivisions.',
  },
  {
    to: '/regions',
    title: 'Regions',
    description: 'National and state/territory region directory from the regions endpoint.',
  },
  { to: '/states', title: 'States', description: 'Open a state or territory spending page.' },
  {
    to: '/data-sources',
    title: 'Data sources',
    description: 'Source register, licence, verification status and connector stubs.',
  },
  {
    to: '/about',
    title: 'About',
    description: 'Phase 1 scope, provenance rules and how mixed measures are handled.',
  },
];

export function HomePage() {
  const coverage = useCoverage();
  const functionsState = useApi('home:functions', () =>
    apiGet<FunctionsResponse>('/api/functions'),
  );
  const sourcesState = useApi('home:sources', () =>
    apiGet<DataSourcesResponse>('/api/data-sources'),
  );

  const divisions = functionsState.data?.functions ?? [];
  const sources = sourcesState.data?.sources ?? [];
  const connectors = coverage.data?.connectors ?? [];

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        ausspend
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        An explorer for published Australian government spending, organised by COFOG function,
        region and state. Synthetic seed rows sit alongside live AusTender contracts and
        data.gov.au PBS budget line items; no figure is verified or a single federal total.
      </Typography>

      {coverage.data ? (
        <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`Phase: ${coverage.data.phase}`} />
          <Chip size="small" label={`Synthetic: ${coverage.data.synthetic ? 'yes' : 'no'}`} />
          <Chip
            size="small"
            label={`Live ingestion: ${coverage.data.live_ingestion ? 'yes' : 'no'}`}
          />
          <Chip size="small" label={`${coverage.data.counts.regions} regions`} />
          <Chip size="small" label={`${coverage.data.counts.functions} COFOG records`} />
          <Chip size="small" label={`${coverage.data.counts.measures} measure rows`} />
          <Chip size="small" label={`${coverage.data.counts.data_sources} source(s)`} />
        </Stack>
      ) : null}

      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>What you are looking at</AlertTitle>
        Every amount in this build is deterministic placeholder data marked{' '}
        <strong>verified: false</strong>. It is not a published Australian government figure. The
        source register and licence live on the{' '}
        <Link component={RouterLink} to="/data-sources">
          Data sources
        </Link>{' '}
        page.
      </Alert>

      <Typography variant="h5" component="h2" gutterBottom>
        Search regions and functions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Results come from <code>/api/regions?q=</code> and <code>/api/search?q=</code>. Region
        results link by <code>_id</code>; state rows link to their state page.
      </Typography>
      <Box sx={{ mb: 4 }} data-testid="home-autocomplete">
        <QuickSearch />
      </Box>

      <Typography variant="h5" component="h2" gutterBottom>
        Explore
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.5,
          mb: 4,
        }}
      >
        {QUICK_LINKS.map((link) => (
          <Button
            key={link.to}
            component={RouterLink}
            to={link.to}
            variant="outlined"
            sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 1.5, px: 2 }}
          >
            <Box>
              <Typography
                variant="subtitle1"
                component="span"
                sx={{ display: 'block', fontWeight: 600 }}
              >
                {link.title}
              </Typography>
              <Typography variant="caption" component="span" color="text.secondary">
                {link.description}
              </Typography>
            </Box>
          </Button>
        ))}
      </Box>

      <Typography variant="h5" component="h2" gutterBottom>
        COFOG divisions in this build
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The taxonomy is shared COFOG data. No national headline total is shown here: the seed mixes
        actual, budget and estimate measures, and the API never sums across measure types.
      </Typography>

      {functionsState.loading ? <LoadingState label="Loading COFOG divisions…" /> : null}
      {functionsState.error ? (
        <ApiErrorState error={functionsState.error} hint="The API may not be running." />
      ) : null}
      {!functionsState.loading && !functionsState.error ? (
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent>
            <Stack divider={<Divider flexItem />} spacing={1}>
              {divisions.map((division) => (
                <Box key={division.code}>
                  <Link
                    component={RouterLink}
                    to={`/functions/${division.code}`}
                    variant="subtitle1"
                  >
                    {division.code} — {division.name}
                  </Link>
                  <Typography variant="caption" component="div" color="text.secondary">
                    {division.subdivisions.length} curated subdivision
                    {division.subdivisions.length === 1 ? '' : 's'}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <ProvenanceFooter
              sources={[]}
              note="COFOG codes and names are shared taxonomy constants, not spending observations."
            />
          </CardContent>
        </Card>
      ) : null}

      {coverage.data ? (
        <Card variant="outlined" sx={{ mb: 4 }} data-testid="coverage-limitations">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Coverage limitations
            </Typography>
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

      <Typography variant="h5" component="h2" gutterBottom>
        Ingestion connectors
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {connectors.length} connectors are registered;{' '}
        {coverage.data?.connector_status_counts?.stub ??
          connectors.filter((connector) => connector.status === 'stub').length}{' '}
        are stubs.{' '}
        {coverage.data?.live_ingestion
          ? 'AusTender contracts and PBS budget line items are live; stubs make no network request.'
          : 'No live data has been ingested yet.'}
      </Typography>
      {coverage.data ? (
        <Card variant="outlined" data-testid="connector-status">
          <CardContent>
            <Stack divider={<Divider flexItem />} spacing={1}>
              {connectors.map((connector) => (
                <Box key={connector.id}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle1">{connector.name}</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={connector.status === 'stub' ? 'stub — not wired' : connector.status}
                    />
                    <Chip size="small" variant="outlined" label={connector.id} />
                  </Stack>
                  <Typography variant="caption" component="div" color="text.secondary">
                    {connector.publisher} · status “
                    {connector.status === 'stub' ? 'stub — not wired' : connector.status}” ·{' '}
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
      ) : (
        <Typography variant="body2" color="text.secondary">
          Connector status is unavailable because coverage metadata could not be loaded.
        </Typography>
      )}

      <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4 }}>
        Source verification status
      </Typography>
      {sourcesState.loading ? <LoadingState label="Loading source register…" /> : null}
      {sourcesState.error ? <ApiErrorState error={sourcesState.error} /> : null}
      {!sourcesState.loading && !sourcesState.error ? (
        <Card variant="outlined">
          <CardContent>
            {sources.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No sources are registered.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {sources.map((source) => (
                  <Box key={source.source_id}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Typography variant="subtitle1">{source.name}</Typography>
                      <VerifiedBadge verified={source.verified} />
                      <Chip size="small" variant="outlined" label={source.source_id} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {source.publisher} · {source.license} · retrieved{' '}
                      {formatDate(source.retrieved_at)}
                    </Typography>
                    <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
                      <SourceLink
                        sourceId={source.source_id}
                        sourceUrl={source.source_url}
                        label={`Open ${source.source_id}`}
                      />
                    </Typography>
                    {source.notes ? (
                      <Typography
                        variant="caption"
                        component="div"
                        color="text.secondary"
                        sx={{ mt: 0.5 }}
                      >
                        {source.notes}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            )}
            <ProvenanceFooter
              sources={sources}
              note="Synthetic seed rows are placeholders; AusTender and PBS rows carry their own unverified source provenance."
            />
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
