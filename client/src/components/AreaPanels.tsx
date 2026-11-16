import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { AreaPanel, AreaProfile } from '../api/types';
import { formatCents, titleCase } from '../format';

const PANEL_ORDER: AreaPanel['key'][] = [
  'local',
  'state_nsw',
  'federal_nsw_tagged',
  'commonwealth_pbs',
];

const PANEL_TEST_ID: Record<AreaPanel['key'], string> = {
  local: 'area-panel-local',
  state_nsw: 'area-panel-state',
  federal_nsw_tagged: 'area-panel-federal',
  commonwealth_pbs: 'area-panel-pbs',
};

function PanelCard({ panel }: { panel: AreaPanel }) {
  return (
    <Card variant="outlined" data-testid={PANEL_TEST_ID[panel.key]}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h6" component="h3">
            {panel.label}
          </Typography>
          <Chip size="small" variant="outlined" label={panel.jurisdiction_level} />
          <Chip size="small" label={`${panel.count.toLocaleString('en-AU')} row(s)`} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1.5 }}>
          {panel.description}
        </Typography>
        {panel.by_measure_type.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No rows in this panel. Nothing is estimated or zero-filled.
          </Typography>
        ) : (
          <Box
            component="table"
            sx={{ width: '100%', borderCollapse: 'collapse', '& td, & th': { py: 0.5 } }}
          >
            <thead>
              <tr>
                <th align="left">Measure type</th>
                <th align="right">Rows</th>
                <th align="right">Total (that measure type only)</th>
              </tr>
            </thead>
            <tbody>
              {panel.by_measure_type.map((total) => (
                <tr key={total.measure_type}>
                  <td>{titleCase(total.measure_type)}</td>
                  <td align="right">{total.count.toLocaleString('en-AU')}</td>
                  <td align="right">{formatCents(total.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
          No total across measure types is shown for this panel.
        </Typography>
      </CardContent>
    </Card>
  );
}

export function AreaPanels({ profile }: { profile: AreaProfile }) {
  const panels = PANEL_ORDER.map((key) => profile.panels.find((panel) => panel.key === key)).filter(
    (panel): panel is AreaPanel => Boolean(panel),
  );

  return (
    <Box data-testid="area-profile" sx={{ mb: 3 }}>
      <Alert severity="warning" data-testid="area-caution" sx={{ mb: 2 }}>
        <strong>Double-counting caution.</strong> {profile.caution}
      </Alert>
      <Stack spacing={2}>
        {panels.map((panel) => (
          <PanelCard key={panel.key} panel={panel} />
        ))}
      </Stack>
      <Card variant="outlined" data-testid="area-not-covered" sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" component="h3" gutterBottom>
            Not covered
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Only Dubbo Regional Council has a local connector in S3. The following are shown as not
            covered rather than estimated:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {profile.not_covered.councils.map((council) => (
              <Chip key={council} size="small" variant="outlined" label={council} />
            ))}
            {profile.not_covered.states.map((state) => (
              <Chip key={state} size="small" variant="outlined" label={state} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
