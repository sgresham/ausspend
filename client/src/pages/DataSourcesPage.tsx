import { Alert, Box, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import { apiGet } from '../api';
import type { DataSourcesResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useCoverage } from '../coverage';
import { formatDate } from '../format';
import { ProvenanceFooter, SourceLink, VerifiedBadge } from '../components/Provenance';
import { ApiErrorState, EmptyState, LoadingState } from '../components/StatusViews';

export function DataSourcesPage() {
  const state = useApi('data-sources', () => apiGet<DataSourcesResponse>('/api/data-sources'));
  const coverage = useCoverage();
  const sources = state.data?.sources ?? [];
  const connectors = coverage.data?.connectors ?? [];

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Data sources
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The registered sources behind every figure. Phase 1 has a single synthetic seed source, and
        it is explicitly unverified. The anchor <code>#synthetic-seed</code> resolves to that source
        below. The registered ingestion connectors are listed with their real status; no federal
        connector is live in F1.
      </Typography>

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
                        : 'Unverified — not a published government figure'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ingestion status
                    </Typography>
                    <Typography variant="body2">
                      {source.status} · {source.records_ingested} record(s)
                      {source.last_ingested_at
                        ? ` · last ingested ${formatDate(source.last_ingested_at)}`
                        : ' · never ingested'}
                    </Typography>
                  </Box>

                  {source.notes ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      {source.notes}
                    </Typography>
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
        and ingests no records; an <strong>active</strong> connector has ingested and a{' '}
        <strong>degraded</strong> connector reports errors. The three federal source ids
        (aus-tender, data-gov-au-pbs, grantconnect) are stubs until F2/PBS/GrantConnect.
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
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {connector.publisher} · {connector.records_ingested} record(s)
                    {connector.last_fetched_at
                      ? ` · last fetched ${formatDate(connector.last_fetched_at)}`
                      : ' · never fetched'}
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
    </Box>
  );
}
