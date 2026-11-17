import { Alert, Box, Card, CardContent, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

interface BlockProps {
  id: string;
  testId: string;
  title: string;
  children: React.ReactNode;
}

function Block({ id, testId, title, children }: BlockProps) {
  return (
    <Card
      component="section"
      id={id}
      variant="outlined"
      data-testid={testId}
      aria-labelledby={`${id}-heading`}
      sx={{ mb: 3, scrollMarginTop: '88px' }}
    >
      <CardContent>
        <Typography id={`${id}-heading`} variant="h5" component="h2" gutterBottom>
          {title}
        </Typography>
        <Stack spacing={1.5}>{children}</Stack>
      </CardContent>
    </Card>
  );
}

export function LegalPage() {
  return (
    <Box data-testid="legal-page">
      <Typography variant="h1" gutterBottom>
        Legal, privacy and data notices
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        These notices explain the limits of the information on ausspend, the copyright and
        attribution attached to the source data, how the spending figures are put together, and how
        privacy is handled.
      </Typography>

      <Alert severity="info" data-testid="legal-not-advice" sx={{ mb: 3 }}>
        <strong>This page is general information, not legal advice.</strong> Obtain professional
        advice for your circumstances. ausspend is an independent project and is not an official
        government publication.
      </Alert>

      <Block id="quick-notice" testId="legal-quick-notice" title="Quick notice">
        <Typography variant="body2">
          ausspend is an independent explorer of published Australian government spending data. It
          is general information only, not legal or financial advice, and is not an official
          government publication. Figures may be unverified, derived or normalised, and may mix
          non-comparable measures. Check the provenance shown beside each figure before relying on
          it. The blocks below give the full disclaimer, copyright and attribution, data explainer
          and privacy note.
        </Typography>
      </Block>

      <Block id="disclaimer" testId="legal-disclaimer" title="Full disclaimer">
        <Typography variant="body2">
          The information on ausspend is provided for general information and research only. It is
          not legal, financial, tax or other professional advice, and must not be relied on as such.
          Obtain professional advice for your circumstances.
        </Typography>
        <Typography variant="body2">
          ausspend does not create or audit the source data. Figures may be incomplete, provisional,
          unverified, derived or affected by changes made by the original publisher. ausspend gives
          no warranty that the information is accurate, complete or current, and to the extent
          permitted by law accepts no liability for loss arising from reliance on it.
        </Typography>
        <Typography variant="body2">
          ausspend is not an official government publication and is not affiliated with, endorsed by
          or acting for any government, agency or publisher. Links to external sites are provided
          for reference; those sites and their content are governed by their own terms.
        </Typography>
        <Typography variant="body2">
          Content may be corrected, updated or removed without notice.
        </Typography>
      </Block>

      <Block id="copyright" testId="legal-copyright" title="Copyright and attribution">
        <Typography variant="body2">
          The source datasets and documents remain the copyright of their publishers. ausspend
          reproduces or derives figures from them under the terms stated by the original publisher.
          Not all sources are CC BY: some are used under other terms, including public-interest use
          for Dubbo Regional Council documents, and other source-specific terms. Check the licence
          and provenance shown against each source on the{' '}
          <Link component={RouterLink} to="/data-sources">
            Data sources
          </Link>{' '}
          page.
        </Typography>
        <Typography variant="body2">
          Where a source is licensed under Creative Commons Attribution (CC BY), the attribution is
          retained. Example: &quot;© State of New South Wales (NSW Treasury), (2025). Licence: CC BY
          3.0 AU.&quot;
        </Typography>
        <Typography variant="body2">
          If you reuse a figure, attribute the original publisher under the terms it states and cite
          the source record in ausspend. Do not describe ausspend as the publisher of the underlying
          data. The ausspend site&apos;s own text and design are © ausspend contributors, except
          where otherwise stated.
        </Typography>
      </Block>

      <Block id="about-this-data" testId="legal-data" title="About this data">
        <Typography variant="body2">
          Every measure record carries a <code>measure_type</code> and its provenance — the source
          id, source URL and verification flag, plus where relevant the aggregation role and
          jurisdiction. The interface repeats those details beside rows, totals and charts, so a
          figure does not appear without the source it came from.
        </Typography>
        <Typography variant="body2">
          ausspend does not create or audit source data. Some displayed totals and aggregates are
          derived or normalised from published line items — for example, the Sydney Water total
          expenses figure is derived from the printed note totals, and ABS GFS aggregates are
          published top-down benchmarks. Derived totals are documented and labelled, and provenance
          is preserved.
        </Typography>
        <Typography variant="body2">
          Measures are not all comparable. <code>actual</code>, <code>budget</code>,{' '}
          <code>estimate</code>, <code>contract</code> and <code>grant_award</code> are kept
          separate, and when a response mixes them ausspend shows no headline total.
          Cross-jurisdiction or cross-measure sums may double count: the same funding can appear as
          a grant and a contract, or in both a jurisdiction total and an entity or benchmark
          aggregate. Do not add figures across measures, levels or entities unless the documentation
          explicitly says they are additive.
        </Typography>
        <Typography variant="body2">
          Each source&apos;s publisher, licence, retrieval date, ingestion status and limitations
          are listed on the{' '}
          <Link component={RouterLink} to="/data-sources">
            Data sources and provenance
          </Link>{' '}
          page.
        </Typography>
      </Block>

      <Block id="privacy" testId="legal-privacy" title="Privacy">
        <Typography variant="body2">
          ausspend aims to handle personal information consistently with the Privacy Act 1988 (Cth)
          and the Australian Privacy Principles (APPs).
        </Typography>
        <Typography variant="body2">
          The site does not require an account and does not add analytics, advertising or cross-site
          tracking. ausspend does not intentionally collect personal information through the
          explorer. Standard server logs may record technical information such as an IP address,
          user agent and requested URL for security and operation.
        </Typography>
        <Typography variant="body2">
          If you contact us, your details are used only to respond. You can ask about access,
          correction or a privacy complaint by emailing privacy@ausspend.com.au.
        </Typography>
        <Alert severity="warning" data-testid="legal-privacy-contact-unconfirmed">
          <strong>Contact to be confirmed.</strong> privacy@ausspend.com.au is a placeholder address
          for this draft and is not a confirmed working mailbox. Do not send personal or sensitive
          information until this note is removed.
        </Alert>
        <Typography variant="body2">This privacy note may be updated.</Typography>
      </Block>
    </Box>
  );
}
