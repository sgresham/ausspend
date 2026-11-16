import { Chip, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { MeasureType } from '../api/types';
import { formatCents, titleCase } from '../format';

import { uniqueSources, type ProvenanceSourceRef } from '../provenance';

export type { ProvenanceSourceRef } from '../provenance';

/**
 * A link to a source. Internal paths (the synthetic seed's
 * `/data-sources#synthetic-seed`) stay in the app; anything else opens in a
 * new tab.
 */
export function SourceLink({
  sourceId,
  sourceUrl,
  label,
}: {
  sourceId: string;
  sourceUrl: string;
  label?: string;
}) {
  const text = label ?? sourceId;

  if (sourceUrl.startsWith('/')) {
    return (
      <Link component={RouterLink} to={sourceUrl}>
        {text}
      </Link>
    );
  }

  return (
    <Link href={sourceUrl} target="_blank" rel="noopener noreferrer">
      {text}
    </Link>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <Chip
      size="small"
      label={verified ? 'Verified' : 'Unverified'}
      color={verified ? 'success' : 'warning'}
      variant={verified ? 'filled' : 'outlined'}
    />
  );
}

const MEASURE_COLORS: Record<MeasureType, 'primary' | 'secondary' | 'default'> = {
  actual: 'primary',
  budget: 'secondary',
  estimate: 'default',
  contract: 'primary',
  grant_award: 'secondary',
};

export function MeasureTypeChip({ type }: { type: MeasureType }) {
  return (
    <Chip size="small" variant="outlined" color={MEASURE_COLORS[type]} label={titleCase(type)} />
  );
}

export function FiscalYearChip({ year }: { year: string }) {
  return <Chip size="small" variant="outlined" label={year} />;
}

/** Render integer cents as AUD. Every use also has provenance beside it. */
export function Amount({ cents, compact = false }: { cents: number; compact?: boolean }) {
  return (
    <span aria-label={`${formatCents(cents)} Australian dollars`}>
      {formatCents(cents, compact)}
    </span>
  );
}

/** A compact inline source reference for table cells. */
export function SourceCell({ sources }: { sources: readonly ProvenanceSourceRef[] }) {
  const unique = uniqueSources(sources);
  if (unique.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No source reference
      </Typography>
    );
  }

  return (
    <Stack spacing={0.5} alignItems="flex-start">
      {unique.map((source) => (
        <Stack
          key={source.source_id}
          direction="row"
          spacing={0.5}
          alignItems="center"
          flexWrap="wrap"
        >
          <SourceLink sourceId={source.source_id} sourceUrl={source.source_url} />
          <VerifiedBadge verified={source.verified} />
        </Stack>
      ))}
    </Stack>
  );
}

/**
 * Provenance for a headline figure or chart. States the source id, its link,
 * verification status and any notes verbatim.
 */
export function ProvenanceFooter({
  sources,
  note,
}: {
  sources: readonly ProvenanceSourceRef[];
  note?: string;
}) {
  const unique = uniqueSources(sources);

  return (
    <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 1 }}>
      <strong>Provenance:</strong>{' '}
      {unique.length === 0 ? (
        'no source reference available.'
      ) : (
        <Stack component="span" spacing={0.5} sx={{ display: 'inline-flex', verticalAlign: 'top' }}>
          {unique.map((source) => (
            <span key={source.source_id}>
              <SourceLink sourceId={source.source_id} sourceUrl={source.source_url} />{' '}
              <VerifiedBadge verified={source.verified} />
              {source.notes ? <> — {source.notes}</> : null}
            </span>
          ))}
        </Stack>
      )}
      {note ? <> {note}</> : null}
    </Typography>
  );
}
