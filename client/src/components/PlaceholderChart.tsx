import { Box, Card, CardContent, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const PLACEHOLDER_SERIES = [
  { label: 'Division A', value: 42 },
  { label: 'Division B', value: 28 },
  { label: 'Division C', value: 18 },
  { label: 'Division D', value: 12 },
];

/**
 * A deliberately synthetic chart that proves Recharts is wired up.
 * It is not a spending series and must be replaced by M1b's real data.
 */
export function PlaceholderChart() {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Chart placeholder
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Illustrative shape only — no real spending data is loaded in this build.
        </Typography>
        <Box sx={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={PLACEHOLDER_SERIES} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis width={32} />
              <Tooltip />
              <Bar dataKey="value" fill="#1f5c8b" radius={[4, 4, 0, 0]} name="Placeholder" />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
