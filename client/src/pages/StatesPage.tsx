import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { AUSTRALIAN_REGIONS } from '@ausspend/shared';
import { RegionDetailView } from '../components/RegionDetailView';
import { ProvenanceFooter } from '../components/Provenance';

function StatesIndex() {
  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        States and territories
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The national row and the eight states/territories from the shared Australian regions list.
        State pages are fetched by abbreviation (NSW, VIC, QLD, WA, SA, TAS, ACT, NT).
      </Typography>
      <ProvenanceFooter
        sources={[]}
        note="This directory lists region taxonomy records; spending and its source appear only on a state or region page."
      />

      <Card variant="outlined">
        <CardContent>
          <List>
            {AUSTRALIAN_REGIONS.map((region, index) => (
              <Box key={region.code}>
                {index > 0 ? <Divider component="li" /> : null}
                <ListItem
                  disableGutters
                  secondaryAction={
                    region.level === 'national' ? (
                      <Link component={RouterLink} to="/regions">
                        View in Regions
                      </Link>
                    ) : (
                      <Link component={RouterLink} to={`/states/${region.code}`}>
                        Open state page
                      </Link>
                    )
                  }
                >
                  <ListItemText
                    primary={
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Typography component="span" variant="subtitle1">
                          {region.code} — {region.name}
                        </Typography>
                        <Chip size="small" variant="outlined" label={region.level} />
                      </Stack>
                    }
                    secondary={
                      region.level === 'national'
                        ? 'National aggregate — it is a region record, so open it from Regions.'
                        : 'State/territory detail page.'
                    }
                  />
                </ListItem>
              </Box>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );
}

export function StatesPage() {
  const { code } = useParams<{ code?: string }>();
  return code ? <RegionDetailView stateCode={code} /> : <StatesIndex />;
}
