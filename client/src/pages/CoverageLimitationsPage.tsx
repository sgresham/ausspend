import { Box, Card, CardContent, Typography } from '@mui/material';
import { useCoverage } from '../coverage';
import { ProvenanceFooter } from '../components/Provenance';
import { ApiErrorState, LoadingState } from '../components/StatusViews';

/**
 * The single home of the coverage-limitations list. The same
 * `coverage.data.limitations` wording is shown here once; Home and Data Sources
 * link to it instead of repeating the full card.
 */
export function CoverageLimitationsPage() {
  const coverage = useCoverage();

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Coverage limitations
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        What this build does not cover, and the caveats that apply to the figures it does show.
        These limitations are unchanged from the coverage metadata shown elsewhere; they are listed
        in full here once rather than repeated on the home and data-sources pages.
      </Typography>

      {coverage.loading ? <LoadingState label="Loading coverage limitations…" /> : null}
      {coverage.error ? (
        <ApiErrorState error={coverage.error} hint="The API may not be running." />
      ) : null}

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
