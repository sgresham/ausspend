import {
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type {
  PerMeasureTypeTotal,
  RegionRef,
  SpendingBreakdownBase,
  SpendingSummary,
} from '../api/types';
import { titleCase } from '../format';
import { uniqueSources, type ProvenanceSourceRef } from '../provenance';
import { Amount, MeasureTypeChip, ProvenanceFooter } from './Provenance';

function GroupTotal({ group }: { group: SpendingBreakdownBase }) {
  if (group.mixed || group.total_cents === null) {
    return (
      <Typography variant="body2" color="text.secondary">
        Mixed — no total
      </Typography>
    );
  }
  return <Amount cents={group.total_cents} />;
}

function TypeTotalsInline({ totals }: { totals: PerMeasureTypeTotal[] }) {
  if (totals.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No per-type totals
      </Typography>
    );
  }
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {totals.map((entry) => (
        <Typography variant="caption" component="span" key={entry.measure_type}>
          {titleCase(entry.measure_type)}: <Amount cents={entry.total_cents} compact /> (
          {entry.count})
        </Typography>
      ))}
    </Stack>
  );
}

function regionHref(region: RegionRef): string {
  return region.level === 'state' ? `/states/${region.code}` : `/regions/${region._id}`;
}

/**
 * Whole-filtered-set summary for the spending explorer. It renders the API's
 * per-type totals, withholds any headline total when measure types are mixed,
 * and shows the API's function/region breakdown groups.
 */
export function SpendingSummaryPanel({
  summary,
  sources,
  note,
}: {
  summary: SpendingSummary;
  sources: readonly ProvenanceSourceRef[];
  note?: string;
}) {
  const unique = uniqueSources(sources);

  return (
    <Box>
      {summary.mixed ? (
        <Alert severity="warning" sx={{ mb: 3 }} data-testid="mixed-warning">
          <AlertTitle>Measure types are mixed — no headline total</AlertTitle>
          These filters match {summary.measure_types.map((type) => titleCase(type)).join(', ')}{' '}
          measures. Measure types are not comparable, so ausspend does not add them together or
          present a headline total. Read the per-measure-type totals below.
        </Alert>
      ) : summary.total_cents !== null && summary.total_measure_type !== null ? (
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
              Sum of {summary.count} rows for one measure type, computed by the API over the whole
              filtered set.
            </Typography>
            <ProvenanceFooter sources={unique} note={note} />
          </CardContent>
        </Card>
      ) : null}

      <Card variant="outlined" sx={{ mb: 3 }} data-testid="spending-per-type-totals">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Per-measure-type totals
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Whole filtered set: {summary.count} rows. Totals come from the API&apos;s
            total_by_measure_type and are never summed across measure types.
          </Typography>
          <TableContainer>
            <Table size="small" aria-label="Per-measure-type totals">
              <TableHead>
                <TableRow>
                  <TableCell>Measure type</TableCell>
                  <TableCell align="right">Rows</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.total_by_measure_type.map((entry) => (
                  <TableRow key={entry.measure_type}>
                    <TableCell>
                      <MeasureTypeChip type={entry.measure_type} />
                    </TableCell>
                    <TableCell align="right">{entry.count}</TableCell>
                    <TableCell align="right">
                      <Amount cents={entry.total_cents} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <ProvenanceFooter sources={unique} note={note} />
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }} data-testid="spending-by-function">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Breakdown by function
          </Typography>
          <TableContainer>
            <Table size="small" aria-label="Spending breakdown by function">
              <TableHead>
                <TableRow>
                  <TableCell>Function</TableCell>
                  <TableCell align="right">Rows</TableCell>
                  <TableCell>Measure types</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Per-type totals</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.breakdown_by_function.map((group) => (
                  <TableRow key={group.function.code}>
                    <TableCell>
                      <Link component={RouterLink} to={`/functions/${group.function.code}`}>
                        {group.function.code} — {group.function.name}
                      </Link>
                    </TableCell>
                    <TableCell align="right">{group.count}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {group.measure_types.map((type) => (
                          <MeasureTypeChip key={type} type={type} />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <GroupTotal group={group} />
                    </TableCell>
                    <TableCell>
                      <TypeTotalsInline totals={group.total_by_measure_type} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }} data-testid="spending-by-region">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Breakdown by region
          </Typography>
          <TableContainer>
            <Table size="small" aria-label="Spending breakdown by region">
              <TableHead>
                <TableRow>
                  <TableCell>Region</TableCell>
                  <TableCell align="right">Rows</TableCell>
                  <TableCell>Measure types</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Per-type totals</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.breakdown_by_region.map((group) => (
                  <TableRow key={group.region._id}>
                    <TableCell>
                      <Link component={RouterLink} to={regionHref(group.region)}>
                        {group.region.code} — {group.region.name}
                      </Link>
                    </TableCell>
                    <TableCell align="right">{group.count}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {group.measure_types.map((type) => (
                          <MeasureTypeChip key={type} type={type} />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <GroupTotal group={group} />
                    </TableCell>
                    <TableCell>
                      <TypeTotalsInline totals={group.total_by_measure_type} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
