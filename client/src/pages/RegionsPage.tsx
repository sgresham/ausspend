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
import { AUSTRALIAN_REGIONS } from '@ausspend/shared';
import { apiGet } from '../api';
import type { SearchResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { RegionDetailView } from '../components/RegionDetailView';
import { LoadingState } from '../components/StatusViews';
import { ProvenanceFooter } from '../components/Provenance';

function RegionsIndex() {
  // There is no region-list endpoint; resolve the national row's _id from the
  // bounded search API so the national row links to its real region page.
  const national = useApi('regions:national', () => apiGet<SearchResponse>('/api/search?q=AUS'));
  const nationalRegion =
    national.data?.regions.find((region) => region.code === 'AUS' && region.level === 'national') ??
    null;

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Regions
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        The national row plus the eight states and territories from the shared Australian regions
        list. Sub-state region pages open from search results, because only the national and state
        rows are seeded in Phase 1.
      </Typography>
      <ProvenanceFooter
        sources={[]}
        note="This directory lists region taxonomy records; spending and its source appear only on a region or state page."
      />

      {national.loading ? <LoadingState label="Resolving the national region…" /> : null}
      {national.error ? (
        <Typography variant="caption" component="div" color="text.secondary" sx={{ mb: 2 }}>
          The national region link could not be resolved ({national.error.message}). Use Search to
          open it.
        </Typography>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <List>
            {AUSTRALIAN_REGIONS.map((region, index) => (
              <Box key={region.code}>
                {index > 0 ? <Divider component="li" /> : null}
                <ListItem
                  disableGutters
                  secondaryAction={
                    region.level === 'national' ? (
                      nationalRegion ? (
                        <Link component={RouterLink} to={`/regions/${nationalRegion._id}`}>
                          National region page
                        </Link>
                      ) : (
                        <Link component={RouterLink} to="/search?q=Australia">
                          Find national region
                        </Link>
                      )
                    ) : (
                      <Link component={RouterLink} to={`/states/${region.code}`}>
                        Open state page
                      </Link>
                    )
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
                    secondary={
                      region.level === 'national'
                        ? 'National aggregate row (a region record, not a state/territory).'
                        : 'State/territory row; its region page is also reachable from search results.'
                    }
                  />
                </ListItem>
              </Box>
            ))}
          </List>
        </CardContent>
      </Card>

      <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 2 }}>
        Region identities come from the seeded region records via the API; this directory does not
        invent region ids.
      </Typography>
    </Box>
  );
}

export function RegionsPage() {
  const { regionId } = useParams<{ regionId?: string }>();
  return regionId ? <RegionDetailView regionId={regionId} /> : <RegionsIndex />;
}
