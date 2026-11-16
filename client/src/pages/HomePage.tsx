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
import { formatDate } from '../format';
import { ProvenanceFooter, SourceLink, VerifiedBadge } from '../components/Provenance';
import { ApiErrorState, LoadingState } from '../components/StatusViews';

const QUICK_LINKS = [
  {
    to: '/functions',
    title: 'Functions',
    description: 'Browse the ten COFOG divisions and their subdivisions.',
  },
  {
    to: '/regions',
    title: 'Regions',
    description: 'National and state/territory region directory.',
  },
  { to: '/states', title: 'States', description: 'Open a state or territory spending page.' },
  { to: '/search', title: 'Search', description: 'Find a function or region by name or code.' },
  {
    to: '/data-sources',
    title: 'Data sources',
    description: 'Source register, licence and verification status.',
  },
];

export function HomePage() {
  const functionsState = useApi('home:functions', () =>
    apiGet<FunctionsResponse>('/api/functions'),
  );
  const sourcesState = useApi('home:sources', () =>
    apiGet<DataSourcesResponse>('/api/data-sources'),
  );

  const divisions = functionsState.data?.functions ?? [];
  const sources = sourcesState.data?.sources ?? [];

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        ausspend
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        An explorer for published Australian government spending, organised by COFOG function,
        region and state. Phase 1 uses a synthetic development seed only: no live ingestion has
        happened.
      </Typography>

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
        actual, budget and estimate measures, and the API does not expose a comparable national
        total across those types.
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

      <Typography variant="h5" component="h2" gutterBottom>
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
              note="The only Phase 1 source is the synthetic seed, and it is unverified."
            />
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
