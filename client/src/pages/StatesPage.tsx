import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { apiGet } from '../api';
import type { RegionsResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { RegionDetailView } from '../components/RegionDetailView';
import { ApiErrorState, EmptyState, LoadingState } from '../components/StatusViews';
import { ProvenanceFooter } from '../components/Provenance';

function StatesIndex() {
  const state = useApi('states:list', () =>
    apiGet<RegionsResponse>('/api/regions?type=state&limit=200'),
  );
  const regions = state.data?.regions ?? [];

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        States and territories
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The eight states and territories from <code>GET /api/regions?type=state</code>. State pages
        are fetched by abbreviation (NSW, VIC, QLD, WA, SA, TAS, ACT, NT). Each page includes that
        government&apos;s state or territory budget rows; federal rows merely located in the state
        and local council rows are excluded. Benchmark-only layers such as TAS are shown separately
        at <code>/benchmark</code> and are never added to additive totals.
      </Typography>
      <ProvenanceFooter
        sources={[]}
        note="This directory lists state/territory taxonomy records from the API; spending and its source appear only on a state page."
      />

      {state.loading ? <LoadingState label="Loading states and territories…" /> : null}
      {state.error ? <ApiErrorState error={state.error} /> : null}
      {!state.loading && !state.error ? (
        regions.length === 0 ? (
          <EmptyState
            title="No states returned"
            message="The regions endpoint returned no state rows."
          />
        ) : (
          <Card variant="outlined">
            <CardContent>
              <List>
                {regions.map((region, index) => (
                  <Box key={region._id}>
                    {index > 0 ? <Divider component="li" /> : null}
                    <ListItem
                      disableGutters
                      secondaryAction={
                        <Link component={RouterLink} to={`/states/${region.code}`}>
                          Open state page
                        </Link>
                      }
                    >
                      <ListItemText
                        primary={
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                          >
                            <Typography component="span" variant="subtitle1">
                              {region.code} — {region.name}
                            </Typography>
                            <Chip size="small" variant="outlined" label={region.level} />
                          </Stack>
                        }
                        secondary={`State/territory detail page · region _id ${region._id}`}
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            </CardContent>
          </Card>
        )
      ) : null}
    </Box>
  );
}

export function StatesPage() {
  const { code } = useParams<{ code?: string }>();
  return code ? <RegionDetailView stateCode={code} /> : <StatesIndex />;
}
