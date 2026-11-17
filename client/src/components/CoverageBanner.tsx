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
        <strong>Coverage status unavailable.</strong> Some rows may come from the synthetic
        development seed and some may be live AusTender or PBS records; no figure is verified.{' '}
        {error ? <>Coverage metadata could not be loaded ({error.message}). </> : null}
        <Link component={RouterLink} to="/data-sources">
          Source register
        </Link>
      </Alert>
    );
  }

  const syntheticRows = data.counts.synthetic_measures ?? (data.synthetic ? null : 0);

  return (
    <Alert severity="warning" sx={{ mb: 3 }} data-testid="coverage-banner">
      <strong>{data.phase}.</strong>{' '}
      {data.synthetic
        ? data.live_ingestion
          ? 'Live AusTender contract records, PBS budget line items, NSW Budget rows, selected data.nsw.gov.au CKAN rows, VIC Budget 2026-27 rows, QLD Budget 2026-27 BP3/BP4 rows and QLD QGIP 2024-25 grant/contract expenditure are included next to the synthetic development seed. Ingested rows are real published records; seed rows remain placeholders. PBS line items do not sum to the federal total, QGIP grants and contracts are never summed, and CKAN rows with an inferred unit are provisional. '
          : 'Synthetic development seed data only; no live ingestion has run. '
        : 'No synthetic seed rows are present. Real AusTender contracts, PBS budget line items, NSW Budget/CKAN rows, VIC Budget 2026-27 rows, QLD Budget 2026-27 BP3/BP4 rows, QLD QGIP 2024-25 grant/contract expenditure and Dubbo rows are shown with provenance. National and state actual/estimate spending with COFOG and region is not covered by any real feed yet, so those views show an explicit “no real data for this dimension yet” state rather than a placeholder or a zero. '}
      No figure is human-verified or a single government total.{' '}
      <Stack component="span" direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        <span>{data.counts.regions} regions</span>
        <span>{data.counts.functions} COFOG records</span>
        <span>{data.counts.measures} measure rows</span>
        {syntheticRows !== null ? <span>{syntheticRows} synthetic seed rows</span> : null}
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
