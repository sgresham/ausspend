import {
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type {
  FunctionGroup,
  MeasureRow,
  MeasureType,
  RankedState,
  RegionGroup,
} from '../api/types';
import { titleCase } from '../format';
import { Amount, FiscalYearChip, MeasureTypeChip, SourceCell } from './Provenance';
import { uniqueSources } from '../provenance';

function TableTitle({ children, caption }: { children: string; caption?: string }) {
  return (
    <>
      <Typography variant="h6" gutterBottom>
        {children}
      </Typography>
      {caption ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {caption}
        </Typography>
      ) : null}
    </>
  );
}

/**
 * Every measure row, with its own source link, verification badge and notes.
 * `labelFor` renders the cross-cutting dimension (region on a function page,
 * function on a region page).
 */
export function MeasureRowsTable({
  rows,
  labelFor,
  caption,
  testId,
}: {
  rows: MeasureRow[];
  labelFor: (row: MeasureRow) => string;
  caption: string;
  testId: string;
}) {
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <TableTitle caption={caption}>{`All measure rows (${rows.length})`}</TableTitle>
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader aria-label="Measure rows" data-testid={testId}>
            <TableHead>
              <TableRow>
                <TableCell>Dimension</TableCell>
                <TableCell>Measure type</TableCell>
                <TableCell>Fiscal year</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Source / verification</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{labelFor(row)}</TableCell>
                  <TableCell>
                    <MeasureTypeChip type={row.measure_type} />
                  </TableCell>
                  <TableCell>
                    <FiscalYearChip year={row.fiscal_year} />
                  </TableCell>
                  <TableCell align="right">
                    <Amount cents={row.amount_cents} />
                  </TableCell>
                  <TableCell>
                    <SourceCell sources={[row]} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {row.notes ?? '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

/** Region/state detail: spending grouped by COFOG function. */
export function FunctionBreakdownTable({ groups }: { groups: FunctionGroup[] }) {
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <TableTitle caption="Each function's total is shown only when one measure type is present; mixed rows never carry a comparable total.">
          Spending by COFOG function
        </TableTitle>
        <TableContainer>
          <Table size="small" aria-label="Spending by function" data-testid="by-function-table">
            <TableHead>
              <TableRow>
                <TableCell>Function</TableCell>
                <TableCell>Measure types</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Source / verification</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.function.code}>
                  <TableCell>
                    {group.function.code} — {group.function.name}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {group.measure_types.map((type) => (
                        <MeasureTypeChip key={type} type={type} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {group.total_cents === null ? (
                      <Typography variant="body2" color="text.secondary">
                        Mixed — no total
                      </Typography>
                    ) : (
                      <Amount cents={group.total_cents} />
                    )}
                  </TableCell>
                  <TableCell>
                    <SourceCell sources={group.measures} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

/** Function detail: state-only ranked list for a single measure type. */
export function RankedStatesTable({
  ranked,
  byRegion,
}: {
  ranked: RankedState[];
  byRegion: RegionGroup[];
}) {
  const regionGroups = new Map(byRegion.map((group) => [group.region._id, group]));

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <TableTitle caption="Ranked state totals for the selected single measure type. National and sub-state rows are excluded from the ranking.">
          Ranked states
        </TableTitle>
        <TableContainer>
          <Table size="small" aria-label="Ranked states" data-testid="ranked-states-table">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>State / territory</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Source / verification</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ranked.map((entry, index) => (
                <TableRow key={entry.region._id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    {entry.region.code} — {entry.region.name}
                  </TableCell>
                  <TableCell align="right">
                    <Amount cents={entry.total_cents} />
                  </TableCell>
                  <TableCell>
                    <SourceCell sources={regionGroups.get(entry.region._id)?.measures ?? []} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

/** Mixed response: per-measure-type totals computed from the measure rows. */
export function MeasureTypeBreakdownTable({
  measureTypes,
  rows,
  limit,
}: {
  measureTypes: MeasureType[];
  rows: MeasureRow[];
  limit: number;
}) {
  const totals = new Map<MeasureType, MeasureRow[]>();
  for (const row of rows) {
    const group = totals.get(row.measure_type) ?? [];
    group.push(row);
    totals.set(row.measure_type, group);
  }

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <TableTitle
          caption={`Computed from the ${rows.length} measure rows returned with limit=${limit}; sums are per measure type only.`}
        >
          Per-measure-type breakdown
        </TableTitle>
        <TableContainer>
          <Table size="small" aria-label="Per-measure-type breakdown">
            <TableHead>
              <TableRow>
                <TableCell>Measure type</TableCell>
                <TableCell align="right">Rows</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Source / verification</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {measureTypes.map((type) => {
                const group = totals.get(type) ?? [];
                const total = group.reduce((sum, row) => sum + row.amount_cents, 0);
                return (
                  <TableRow key={type}>
                    <TableCell>
                      <MeasureTypeChip type={type} />
                    </TableCell>
                    <TableCell align="right">{group.length}</TableCell>
                    <TableCell align="right">
                      <Amount cents={total} />
                    </TableCell>
                    <TableCell>
                      <SourceCell sources={group} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`${uniqueSources(rows).length} source(s)`} variant="outlined" />
          {measureTypes.map((type) => (
            <Chip key={type} size="small" label={titleCase(type)} variant="outlined" />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
