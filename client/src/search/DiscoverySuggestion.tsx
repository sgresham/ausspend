import { Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useDiscovery } from './DiscoveryProvider';

/**
 * A bounded "did you mean" hint for a dead-end search. It never calls the
 * measure API and only links to a discovery item's own page.
 */
export function DiscoverySuggestion({
  query,
  testId = 'discovery-suggestion',
}: {
  query: string;
  testId?: string;
}) {
  const discovery = useDiscovery();
  const suggestion = discovery.suggest(query);
  if (!suggestion) return null;

  return (
    <Typography variant="body2" sx={{ mt: 1 }} data-testid={testId}>
      Did you mean <RouterLink to={suggestion.href}>{suggestion.label}</RouterLink>? That link opens
      its discovery page; the spending explorer itself still matches words literally.
    </Typography>
  );
}
