import { Alert, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Persistent coverage notice shown on every page. The Phase 1 seed is
 * synthetic, so no figure may be read as published government spending.
 */
export function CoverageBanner() {
  return (
    <Alert severity="warning" sx={{ mb: 3 }} data-testid="coverage-banner">
      <strong>Phase 1 synthetic seed data only.</strong> No live ingestion — every figure is
      unverified and is not a published Australian government figure.{' '}
      <Link component={RouterLink} to="/data-sources">
        Source register
      </Link>
    </Alert>
  );
}
