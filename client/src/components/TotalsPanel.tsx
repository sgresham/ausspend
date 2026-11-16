import { Alert, AlertTitle, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { MeasureSummary } from '../api/types';
import { titleCase } from '../format';
import { Amount, MeasureTypeChip, ProvenanceFooter, type ProvenanceSourceRef } from './Provenance';

/**
 * The one place a detail-page headline total may appear. Totals are only shown
 * for a single measure type; a mixed response renders an explicit warning
 * instead. Per-type totals come from the API, never from summing rows.
 */
export function TotalsPanel({
  summary,
  sources,
  scopeLabel,
  note,
}: {
  summary: MeasureSummary;
  sources: readonly ProvenanceSourceRef[];
  scopeLabel: string;
  note?: string;
}) {
  if (summary.count === 0) return null;

  if (summary.mixed) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }} data-testid="mixed-warning">
        <AlertTitle>Measure types are mixed — no headline total</AlertTitle>
        {scopeLabel} contains {summary.measure_types.map((type) => titleCase(type)).join(', ')}{' '}
        measures. These measure types are not comparable, so ausspend does not add them together or
        present a headline total. Use the filters to select one measure type, or read the
        per-measure-type totals below.
      </Alert>
    );
  }

  if (summary.total_cents === null || summary.total_measure_type === null) {
    return (
      <Alert severity="info" sx={{ mb: 3 }} data-testid="no-total">
        <AlertTitle>No comparable total available</AlertTitle>
        This response does not identify a single measure type, so no headline total is shown.
      </Alert>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 3 }} data-testid="headline-total">
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          Headline total — single measure type
        </Typography>
        <Stack direction="row" spacing={2} alignItems="baseline" flexWrap="wrap" useFlexGap>
          <Typography variant="h4" component="p" data-testid="headline-total-amount">
            <Amount cents={summary.total_cents} />
          </Typography>
          <MeasureTypeChip type={summary.total_measure_type} />
          <Chip size="small" variant="outlined" label={`${summary.count} measure rows`} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {scopeLabel} · sum of {summary.count} rows for one measure type. The total is returned by
          the API over the whole filtered set.
        </Typography>
        <ProvenanceFooter sources={sources} note={note} />
      </CardContent>
    </Card>
  );
}
