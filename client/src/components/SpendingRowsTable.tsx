import {
  Card,
  CardContent,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { SpendingMeasureRow } from '../api/types';
import { Amount, FiscalYearChip, MeasureTypeChip, SourceCell } from './Provenance';

function regionHref(row: SpendingMeasureRow): string {
  return row.region_level === 'state' ? `/states/${row.region_code}` : `/regions/${row.region_id}`;
}

/** One page of `/api/spending` rows, each with its own source and verification. */
export function SpendingRowsTable({ rows }: { rows: SpendingMeasureRow[] }) {
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Spending rows ({rows.length})
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The summary above covers the whole filtered set; this table is only the current page.
          Every row carries its own source id, link and verification status.
        </Typography>
        <TableContainer>
          <Table size="small" aria-label="Spending rows" data-testid="spending-rows">
            <TableHead>
              <TableRow>
                <TableCell>Function</TableCell>
                <TableCell>Region</TableCell>
                <TableCell>Fiscal year</TableCell>
                <TableCell>Measure type</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Source / verification</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link component={RouterLink} to={`/functions/${row.function_code}`}>
                      {row.function_code} — {row.function_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link component={RouterLink} to={regionHref(row)}>
                      {row.region_code} — {row.region_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <FiscalYearChip year={row.fiscal_year} />
                  </TableCell>
                  <TableCell>
                    <MeasureTypeChip type={row.measure_type} />
                  </TableCell>
                  <TableCell align="right">
                    <Amount cents={row.amount_cents} />
                  </TableCell>
                  <TableCell>
                    <SourceCell sources={[row.provenance]} />
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
