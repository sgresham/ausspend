import { Box, Card, CardContent, Chip, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { apiGet } from '../api';
import type { FunctionsResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { FunctionDetailView } from '../components/FunctionDetailView';
import { ApiErrorState, LoadingState } from '../components/StatusViews';
import { ProvenanceFooter } from '../components/Provenance';

function FunctionsIndex() {
  const state = useApi('functions:index', () => apiGet<FunctionsResponse>('/api/functions'));

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Functions (COFOG)
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The ten COFOG divisions used by ausspend, each with its curated subdivisions. Function pages
        show spending against that division; the taxonomy itself carries no amounts.
      </Typography>
      <ProvenanceFooter
        sources={[]}
        note="COFOG codes and names are shared taxonomy constants; no spending figure appears on this index."
      />

      {state.loading ? <LoadingState label="Loading COFOG divisions…" /> : null}
      {state.error ? <ApiErrorState error={state.error} /> : null}
      {state.data ? (
        <Stack spacing={2} data-testid="functions-index">
          {state.data.functions.map((division) => (
            <Card key={division.code} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h6" component="h2" sx={{ mr: 1 }}>
                    <Link component={RouterLink} to={`/functions/${division.code}`}>
                      {division.code} — {division.name}
                    </Link>
                  </Typography>
                  <Chip size="small" label="Division" variant="outlined" />
                  <Chip
                    size="small"
                    label={`${division.subdivisions.length} subdivisions`}
                    variant="outlined"
                  />
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                  {division.subdivisions.map((subdivision) => (
                    <Link
                      key={subdivision.code}
                      component={RouterLink}
                      to={`/functions/${subdivision.code}`}
                      variant="body2"
                    >
                      {subdivision.code} {subdivision.name}
                    </Link>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}

export function FunctionsPage() {
  const { code } = useParams<{ code?: string }>();
  return code ? <FunctionDetailView /> : <FunctionsIndex />;
}
