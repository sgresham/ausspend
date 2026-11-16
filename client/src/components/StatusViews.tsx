import { Alert, AlertTitle, Box, CircularProgress, Typography } from '@mui/material';
import type { ApiError } from '../api/client';

export function LoadingState({ label = 'Loading data…' }: { label?: string }) {
  return (
    <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 4 }}>
      <CircularProgress size={22} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Alert severity="info" sx={{ my: 2 }} data-testid="empty-state">
      <AlertTitle>{title}</AlertTitle>
      {message}
    </Alert>
  );
}

export function ApiErrorState({ error, hint }: { error: ApiError; hint?: string }) {
  const notFound = error.status === 404;
  const title = notFound
    ? 'Not found'
    : error.kind === 'network'
      ? 'Network error'
      : error.status === 400
        ? 'Invalid request'
        : 'Request failed';

  return (
    <Alert severity={notFound ? 'info' : 'error'} sx={{ my: 2 }} data-testid="api-error">
      <AlertTitle>{title}</AlertTitle>
      {error.message}
      {error.status !== null ? (
        <Typography variant="caption" component="div" color="text.secondary">
          HTTP {error.status}
        </Typography>
      ) : null}
      {hint ? (
        <Typography variant="body2" component="div" sx={{ mt: 1 }}>
          {hint}
        </Typography>
      ) : null}
    </Alert>
  );
}
