import {
  Card,
  CardContent,
  Chip,
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
  return row.region_level === 'state'
    ? `/states/${row.region_code ?? ''}`
    : `/regions/${row.region_id ?? ''}`;
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
                <TableCell>Project / description</TableCell>
                <TableCell>Function</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Fiscal year</TableCell>
                <TableCell>Measure type</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Provenance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Typography variant="body2">
                      {row.project_name ?? row.description ?? (
                        <Typography component="span" variant="caption" color="text.secondary">
                          No project title
                        </Typography>
                      )}
                    </Typography>
                    {row.project_name && row.description ? (
                      <Typography variant="caption" color="text.secondary" component="div">
                        {row.description}
                      </Typography>
                    ) : null}
                    {row.expense_category ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={row.aggregation_role === 'expense_total' ? 'primary' : 'default'}
                        label={
                          row.aggregation_role === 'expense_total'
                            ? 'Charity total expenses'
                            : `Charity component — ${row.expense_category.replaceAll('_', ' ')}`
                        }
                        sx={{ mt: 0.5 }}
                      />
                    ) : null}
                    {row.funding_source || row.delivery_entity ? (
                      <Typography variant="caption" color="text.secondary" component="div">
                        {row.funding_source ? <>Buyer: {row.funding_source}. </> : null}
                        {row.delivery_entity ? <>Supplier: {row.delivery_entity}.</> : null}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.function_code ? (
                      <Link component={RouterLink} to={`/functions/${row.function_code}`}>
                        {row.function_code} — {row.function_name}
                      </Link>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No COFOG function
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.region_code ? (
                      <Link component={RouterLink} to={regionHref(row)}>
                        {row.region_code} — {row.region_name}
                      </Link>
                    ) : row.location?.state || row.location?.postcode ? (
                      <Typography variant="body2">
                        {row.location.state ?? 'State not supplied'}
                        {row.location.postcode ? ` ${row.location.postcode}` : ''}
                        {row.data_quality_flag ? (
                          <Typography variant="caption" color="text.secondary" component="div">
                            {row.data_quality_flag}
                          </Typography>
                        ) : null}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No curated region
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <FiscalYearChip year={row.fiscal_year} />
                  </TableCell>
                  <TableCell>
                    <MeasureTypeChip
                      type={row.measure_type}
                      budgeted={row.source_id === 'nsw-budget'}
                    />
                    {row.aggregation_role === 'agency_detail' ||
                    row.aggregation_role === 'policy_measure' ? (
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label="Not additive"
                        sx={{ ml: 0.5 }}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell align="right">
                    <Amount cents={row.amount_cents} />
                  </TableCell>
                  <TableCell>
                    <SourceCell sources={[row.provenance]} />
                    {row.source_dataset ? (
                      <Typography variant="caption" color="text.secondary" component="div">
                        {row.source_dataset}
                        {row.source_date ? ` · ${row.source_date}` : ''}
                      </Typography>
                    ) : null}
                    {row.data_quality_flag ? (
                      <Typography variant="caption" color="text.secondary" component="div">
                        Data quality: {row.data_quality_flag}
                      </Typography>
                    ) : null}
                    {row.unspsc ? (
                      <Typography variant="caption" color="text.secondary" component="div">
                        UNSPSC: {row.unspsc}
                      </Typography>
                    ) : null}
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
