import { Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { MeasureType } from '../api/types';
import { titleCase } from '../format';

export interface FilterSelection {
  fiscalYear: string;
  measureType: string;
}

export interface FilterBarProps {
  years: string[];
  measureTypes: MeasureType[];
  selection: FilterSelection;
  onChange: (next: FilterSelection) => void;
  limitNote?: string;
}

/**
 * Shared fiscal-year / measure-type filter. Values come from the unfiltered
 * response (never hardcoded) and are kept in the URL by the caller.
 */
export function FilterBar({ years, measureTypes, selection, onChange, limitNote }: FilterBarProps) {
  const active = selection.fiscalYear !== '' || selection.measureType !== '';

  return (
    <Card variant="outlined" sx={{ mb: 3 }} data-testid="filter-bar">
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            select
            size="small"
            label="Fiscal year"
            value={selection.fiscalYear}
            onChange={(event) => onChange({ ...selection, fiscalYear: event.target.value })}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="">All fiscal years</MenuItem>
            {years.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Measure type"
            value={selection.measureType}
            onChange={(event) => onChange({ ...selection, measureType: event.target.value })}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="">All measure types</MenuItem>
            {measureTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {titleCase(type)}
              </MenuItem>
            ))}
          </TextField>

          <Button
            variant="outlined"
            onClick={() => onChange({ fiscalYear: '', measureType: '' })}
            disabled={!active}
          >
            Reset filters
          </Button>
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          sx={{ mt: 2 }}
          data-testid="view-filters"
        >
          Showing fiscal year <strong>{selection.fiscalYear || 'all'}</strong> · measure type{' '}
          <strong>{selection.measureType || 'all'}</strong>
          {limitNote ? ` · ${limitNote}` : ''}
        </Typography>

        {years.length === 0 ? (
          <Typography variant="caption" color="text.secondary" component="div">
            No fiscal years are present in the unfiltered response.
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}
