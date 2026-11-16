import { Box, Card, CardContent, Typography } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MeasureType } from '../api/types';
import { formatCents, titleCase } from '../format';
import { ProvenanceFooter, type ProvenanceSourceRef } from './Provenance';

export interface BarDatum {
  label: string;
  value: number;
}

const MEASURE_FILLS: Record<MeasureType, string> = {
  actual: '#1f5c8b',
  budget: '#b35c00',
  estimate: '#5f6b76',
};

/** A single-series horizontal bar chart for one measure type. */
export function SpendingBarChart({
  title,
  description,
  data,
  sources,
  note,
}: {
  title: string;
  description: string;
  data: BarDatum[];
  sources: readonly ProvenanceSourceRef[];
  note?: string;
}) {
  return (
    <Card variant="outlined" sx={{ mb: 3 }} data-testid="spending-bar-chart">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
        <Box sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(value) => formatCents(Number(value), true)}
                fontSize={12}
              />
              <YAxis type="category" dataKey="label" width={190} fontSize={12} />
              <Tooltip formatter={(value) => formatCents(Number(value))} />
              <Bar dataKey="value" name="Amount (AUD)" radius={[0, 4, 4, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.label} fill="#1f5c8b" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
        <ProvenanceFooter sources={sources} note={note} />
      </CardContent>
    </Card>
  );
}

/**
 * A stacked bar by measure type. Used only when a response mixes measure
 * types: it shows the per-type totals side by side, never a combined headline.
 */
export function MeasureTypeStackedBar({
  measureTypes,
  totals,
  sources,
  note,
}: {
  measureTypes: MeasureType[];
  totals: Record<MeasureType, number>;
  sources: readonly ProvenanceSourceRef[];
  note?: string;
}) {
  const data = [
    {
      label: 'Per measure type',
      ...Object.fromEntries(measureTypes.map((type) => [type, totals[type] ?? 0])),
    },
  ];

  return (
    <Card variant="outlined" sx={{ mb: 3 }} data-testid="measure-type-chart">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Per-measure-type totals
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Measure types are not comparable, so they are shown separately. No combined total is
          displayed.
        </Typography>
        <Box sx={{ width: '100%', height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(value) => formatCents(Number(value), true)}
                fontSize={12}
              />
              <YAxis type="category" dataKey="label" width={130} fontSize={12} />
              <Tooltip formatter={(value) => formatCents(Number(value))} />
              <Legend />
              {measureTypes.map((type) => (
                <Bar
                  key={type}
                  dataKey={type}
                  name={titleCase(type)}
                  stackId="measure-types"
                  fill={MEASURE_FILLS[type]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
        <ProvenanceFooter sources={sources} note={note} />
      </CardContent>
    </Card>
  );
}
