import type { ReactNode } from 'react';
import { Alert, Box, Card, CardContent, Typography } from '@mui/material';

export interface PlaceholderPageProps {
  title: string;
  summary: string;
  provenance: string;
  intended: string;
  children?: ReactNode;
}

export function PlaceholderPage({
  title,
  summary,
  provenance,
  intended,
  children,
}: PlaceholderPageProps) {
  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        {summary}
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Provenance:</strong> {provenance}
      </Alert>

      {children}

      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Intended content
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {intended}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
