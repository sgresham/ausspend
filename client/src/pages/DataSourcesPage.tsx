import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { apiGet } from '../api';
import type { DataSourcesResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { formatDate } from '../format';
import { ProvenanceFooter, SourceLink, VerifiedBadge } from '../components/Provenance';
import { ApiErrorState, EmptyState, LoadingState } from '../components/StatusViews';

export function DataSourcesPage() {
  const state = useApi('data-sources', () => apiGet<DataSourcesResponse>('/api/data-sources'));
  const sources = state.data?.sources ?? [];

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Data sources
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The registered sources behind every figure. Phase 1 has a single synthetic seed source, and
        it is explicitly unverified. The anchor <code>#synthetic-seed</code> resolves to that source
        below.
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
    </Box>
  );
}
