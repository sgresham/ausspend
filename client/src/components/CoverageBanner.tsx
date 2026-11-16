import { Alert, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useCoverage } from '../coverage';

/**
 * Persistent coverage notice shown on every page. It is driven by
 * `/api/meta/coverage`; if that request fails the same static synthetic-data
 * warning is rendered so the Phase 1 limitation can never disappear.
 */
export function CoverageBanner() {
  const { data, error } = useCoverage();

  if (!data) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }} data-testid="coverage-banner">
        <strong>Phase 1 synthetic seed data only.</strong> No live ingestion — every figure is
        unverified and is not a published Australian government figure.{' '}
        {error ? <>Coverage metadata could not be loaded ({error.message}). </> : null}
        <Link component={RouterLink} to="/data-sources">
          Source register
        </Link>
      </Alert>
    );
  }

  return (
    <Alert severity="warning" sx={{ mb: 3 }} data-testid="coverage-banner">
      <strong>{data.phase} synthetic seed data only.</strong>{' '}
      {data.synthetic ? 'Synthetic development seed — ' : ''}
      no live ingestion, every figure is unverified and is not a published Australian government
      figure.{' '}
      <Stack component="span" direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        <span>{data.counts.regions} regions</span>
        <span>{data.counts.functions} COFOG records</span>
        <span>{data.counts.measures} measure rows</span>
        <span>{data.counts.data_sources} source(s)</span>
        <Link component={RouterLink} to="/data-sources">
          Source register
        </Link>
      </Stack>
      <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 0.5 }}>
        {data.live_ingestion ? 'Live ingestion is enabled.' : 'Live ingestion is disabled.'}{' '}
        {data.note}
      </Typography>
    </Alert>
  );
}
