import { Box, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Site-wide short legal notice. The full disclaimer, copyright/attribution,
 * data explainer and privacy note live on /legal; this block only summarises
 * them and links there. No analytics or tracking is attached.
 */
export const FOOTER_NOTICE =
  'ausspend is an independent explorer of published Australian government spending data. It is general information only, not legal or financial advice, and is not an official government publication. Figures may be unverified, derived or mix non-comparable measures, so check the provenance beside each figure before relying on it.';

export function Footer() {
  return (
    <Box
      component="footer"
      role="contentinfo"
      data-testid="site-footer"
      sx={{ mt: 6, pt: 3, borderTop: 1, borderColor: 'divider' }}
    >
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          {FOOTER_NOTICE}
        </Typography>
        <Stack
          component="nav"
          aria-label="Legal and site links"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 0.5, sm: 2 }}
          flexWrap="wrap"
          useFlexGap
        >
          <Link component={RouterLink} to="/legal" variant="body2">
            Legal, privacy and data notices
          </Link>
          <Link component={RouterLink} to="/data-sources" variant="body2">
            Data sources and provenance
          </Link>
          <Link component={RouterLink} to="/about" variant="body2">
            About ausspend
          </Link>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Source data remains © the original publishers and is used under the terms they state — not
          all sources are CC BY. See the legal notices for attribution and the data sources page for
          each licence.
        </Typography>
      </Stack>
    </Box>
  );
}
