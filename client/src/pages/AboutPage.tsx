import { Alert, Box, Card, CardContent, Divider, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useCoverage } from '../coverage';
import { ProvenanceFooter } from '../components/Provenance';

export function AboutPage() {
  const coverage = useCoverage();

  return (
    <Box data-testid="about-page">
      <Typography variant="h1" gutterBottom>
        About ausspend
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        ausspend is an explorer for Australian government spending organised by COFOG function,
        region and state. It shows the data it actually has, with provenance beside every figure,
        and refuses to invent totals when measures are not comparable.
      </Typography>

      <Alert severity="warning" sx={{ mb: 3 }} data-testid="about-unverified">
        Phase 1 uses a synthetic development seed. Every figure is unverified and is not a published
        Australian government figure. There is no live ingestion and no claim of real data.
      </Alert>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            Phase 1 scope
          </Typography>
          <Stack component="ul" spacing={1} sx={{ mt: 0, mb: 0, pl: 2.5 }}>
            <Typography component="li" variant="body2">
              Synthetic seed only: deterministic placeholder measure rows, all marked{' '}
              <code>verified: false</code>.
            </Typography>
            <Typography component="li" variant="body2">
              No live ingestion: all eight connectors are stubs and no request leaves the API.
            </Typography>
            <Typography component="li" variant="body2">
              Curated COFOG subset: ten divisions with curated subdivisions, not an exhaustive
              taxonomy.
            </Typography>
            <Typography component="li" variant="body2">
              Region granularity is national plus state/territory only; there are no sub-state
              regions yet.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            Provenance
          </Typography>
          <Typography variant="body2" paragraph>
            Every spending row carries a <code>source_id</code>, source link and verification flag
            from the API. The UI repeats them on rows, totals, charts and table groups, so a figure
            never appears without the source it came from.
          </Typography>
          <Typography variant="body2">
            The synthetic source is documented on the{' '}
            <Link component={RouterLink} to="/data-sources#synthetic-seed">
              Data sources
            </Link>{' '}
            page, together with the eight connector stubs and the coverage limitations.
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            How mixed measures are handled
          </Typography>
          <Typography variant="body2" paragraph>
            Actual, budget and estimate measures are not comparable. When a response mixes them, the
            API returns <code>total_cents: null</code> and per-measure-type totals; ausspend shows a
            warning and <strong>no headline total</strong>. A headline total, ranked states and a
            bar chart appear only when the response contains a single measure type.
          </Typography>
          <Typography variant="body2">
            Per-measure-type totals come from the API&apos;s <code>total_by_measure_type</code>,
            never from client-side summing. Use the{' '}
            <Link component={RouterLink} to="/search">
              spending explorer
            </Link>{' '}
            to filter to one type and see the comparable total.
          </Typography>
        </CardContent>
      </Card>

      {coverage.data ? (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h5" component="h2" gutterBottom>
              Current coverage metadata
            </Typography>
            <Typography variant="body2">
              {coverage.data.phase} · synthetic: {coverage.data.synthetic ? 'yes' : 'no'} · live
              ingestion: {coverage.data.live_ingestion ? 'yes' : 'no'} ·{' '}
              {coverage.data.counts.regions} regions · {coverage.data.counts.functions} COFOG
              records · {coverage.data.counts.measures} measure rows ·{' '}
              {coverage.data.counts.data_sources} source(s).
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Box component="ul" sx={{ mt: 0, mb: 0, pl: 2.5 }}>
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
