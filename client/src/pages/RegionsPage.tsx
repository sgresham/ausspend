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
import type { RegionRef, RegionsResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { RegionDetailView } from '../components/RegionDetailView';
import { ApiErrorState, EmptyState, LoadingState } from '../components/StatusViews';
import { ProvenanceFooter } from '../components/Provenance';

function RegionRow({ region }: { region: RegionRef }) {
  const detailHref =
    region.level === 'state'
      ? `/states/${region.code}`
      : region.level === 'region'
        ? `/regions/${region.slug ?? region._id}`
        : `/regions/${region._id}`;
  const linkLabel =
    region.level === 'national'
      ? 'National region page'
      : region.level === 'state'
        ? 'Open state page'
        : 'Open region page';

  return (
    <ListItem
      disableGutters
      secondaryAction={
        <Link component={RouterLink} to={detailHref}>
          {linkLabel}
        </Link>
      }
    >
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography component="span" variant="subtitle1">
              {region.code} — {region.name}
            </Typography>
            <Chip size="small" variant="outlined" label={region.level} />
          </Stack>
        }
        secondary={
          region.level === 'state'
            ? 'State/territory row; opens the state page by abbreviation.'
            : `Opens /regions/${region._id} using the region _id from /api/regions.`
        }
      />
    </ListItem>
  );
}

function RegionGroup({
  title,
  regions,
  first,
}: {
  title: string;
  regions: RegionRef[];
  first: boolean;
}) {
  if (regions.length === 0) return null;
  return (
    <>
      {!first ? <Divider sx={{ my: 1 }} /> : null}
      <Typography variant="h6" component="h2" sx={{ mt: first ? 0 : 2 }}>
        {title}
      </Typography>
      <List dense>
        {regions.map((region) => (
          <RegionRow key={region._id} region={region} />
        ))}
      </List>
    </>
  );
}

function RegionsIndex() {
  const state = useApi('regions:list', () => apiGet<RegionsResponse>('/api/regions?limit=200'));
  const regions = state.data?.regions ?? [];
  const national = regions.filter((region) => region.level === 'national');
  const states = regions.filter((region) => region.level === 'state');
  const subState = regions.filter((region) => region.level === 'region');

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Regions
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        The national row, the eight states and territories, and the one S3 sub-state region (Dubbo)
        from <code>GET /api/regions</code>. National rows link by <code>_id</code>, state rows by
        abbreviation, and sub-state rows by their slug (for example
        <code>/regions/dubbo</code>, alias <code>/region/dubbo</code> and
        <code>/areas/dubbo</code>). This page does not invent region ids.
      </Typography>
      <ProvenanceFooter
        sources={[]}
        note="This directory lists region taxonomy records from the API; spending and its source appear only on a region or state page."
      />

      {state.loading ? <LoadingState label="Loading regions…" /> : null}
      {state.error ? <ApiErrorState error={state.error} /> : null}
      {!state.loading && !state.error ? (
        regions.length === 0 ? (
          <EmptyState
            title="No regions returned"
            message="The regions endpoint returned no rows."
          />
        ) : (
          <Card variant="outlined" data-testid="regions-list">
            <CardContent>
              <RegionGroup title="National" regions={national} first />
              <RegionGroup
                title="States and territories"
                regions={states}
                first={national.length === 0}
              />
              <RegionGroup
                title="Sub-state regions"
                regions={subState}
                first={national.length === 0 && states.length === 0}
              />
            </CardContent>
          </Card>
        )
      ) : null}
    </Box>
  );
}

export function RegionsPage() {
  const { regionId, slug } = useParams<{ regionId?: string; slug?: string }>();
  const identifier = regionId ?? slug;
  return identifier ? <RegionDetailView regionId={identifier} /> : <RegionsIndex />;
}
