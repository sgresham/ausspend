import { Box, Card, CardContent, Link, Stack, Typography } from '@mui/material';
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

export function HowBuiltPage() {
  return (
    <Box data-testid="how-built-page">
      <Typography variant="h1" gutterBottom>
        How it was built
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        ausspend was built by a human-directed, AI-executed workflow. A person set the direction and
        accepted the outcomes; AI agents carried out the individual work items. This page records
        that process, the public source, the licence and the data publishers whose work the site
        relies on.
      </Typography>

      <Block
        id="human-direction"
        testId="how-built-human-direction"
        title="Human direction, AI execution"
      >
        <Typography variant="body2">
          A human sets the direction and accepts the outcomes. An AI orchestrator turns that
          direction into pool items, answers blocked workers, verifies completions and closes only
          what is proved by git ancestry. AI workers take one item each in isolated git worktrees. A
          reviewer role can PASS or FAIL an item. A stall watchdog nudges stuck leases so work does
          not disappear silently.
        </Typography>
        <Typography variant="body2">
          A merge is proved by ancestry, not by a worker&apos;s word. A completion is accepted only
          when the claimed change is reachable from the landed branch and the stated checks can be
          reproduced. Premises can be falsified: when a source, table or endpoint is not what it was
          claimed to be, the work is documented and deferred rather than invented.
        </Typography>
        <Typography variant="body2">
          This is <strong>not</strong> a claim of full autonomy. The human remains responsible for
          the direction, the accepted trade-offs and the published result. ausspend is an
          independent project; it is not an official government publication and is not endorsed by
          any government or data publisher.
        </Typography>
      </Block>

      <Block id="source-code" testId="how-built-source" title="Source code">
        <Typography variant="body2">
          The source code is public in the{' '}
          <Link
            href="https://github.com/sgresham/ausspend"
            target="_blank"
            rel="noopener noreferrer"
          >
            sgresham/ausspend
          </Link>{' '}
          repository on GitHub. The repository contains the client, server, shared contracts,
          ingestion connectors, tests and documentation.
        </Typography>
      </Block>

      <Block id="licence" testId="how-built-licence" title="Licence">
        <Typography variant="body2">
          The code is released under the <strong>MIT</strong> licence. The licence text is in the{' '}
          <Link
            href="https://github.com/sgresham/ausspend/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            LICENSE file
          </Link>
          .
        </Typography>
        <Typography variant="body2">
          MIT covers the code only. Downloaded source documents, data files and the short quoted
          excerpts used as parser fixtures remain the property of their publishers and are not
          relicensed by ausspend. See the{' '}
          <Link component={RouterLink} to="/legal">
            legal, privacy and data notices
          </Link>{' '}
          and the{' '}
          <Link component={RouterLink} to="/data-sources">
            data sources and provenance
          </Link>{' '}
          page for the terms attached to each source.
        </Typography>
      </Block>

      <Block id="attributions" testId="how-built-attributions" title="Attributions">
        <Typography variant="body2">
          ausspend uses published data from the following publishers, grouped by category. Each
          source&apos;s publisher, licence, retrieval date and limitations are listed on the{' '}
          <Link component={RouterLink} to="/data-sources">
            Data sources and provenance
          </Link>{' '}
          page.
        </Typography>
        <Typography variant="body2">
          <strong>Australian Government.</strong> AusTender contract data (Australian Government
          Department of Finance), Portfolio Budget Statements via data.gov.au, GrantConnect,
          Australian Bureau of Statistics Government Finance Statistics (including the Public
          Non-Financial Corporations benchmark), Australian Institute of Health and Welfare health
          expenditure, and Australian Charities and Not-for-profits Commission charity data.
        </Typography>
        <Typography variant="body2">
          <strong>State and territory treasuries and open-data portals.</strong> New South Wales
          Treasury and data.nsw.gov.au; Victoria, including the Department of Treasury and Finance
          and the Victorian Local Government Grants Commission; Queensland, including the Queensland
          Budget, QGIP and local government comparative information; Western Australia; South
          Australia; Tasmania; the Northern Territory; and the Australian Capital Territory.
        </Typography>
        <Typography variant="body2">
          <strong>Local government.</strong> The individual NSW council general-purpose financial
          statement publishers listed on the{' '}
          <Link component={RouterLink} to="/data-sources">
            Data sources
          </Link>{' '}
          page; and Queensland local government comparative information published by the Queensland
          Department of Local Government, Water and Volunteers.
        </Typography>
        <Typography variant="body2">
          Source documents remain © their publishers. Not all sources are openly licensed: some are
          used under publisher-specific or public-interest terms, and each source&apos;s terms are
          recorded on the Data sources page. ausspend is not an official government publication and
          does not claim the publishers&apos; endorsement.
        </Typography>
      </Block>
    </Box>
  );
}
