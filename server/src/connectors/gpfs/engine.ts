import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import { detectMoneyUnit, moneyToCents, type MoneyUnitKind } from '../pdf-extract.js';
import type { Connector, ConnectorRunMetadata, RawRecord } from '../types.js';

/**
 * Shared engine for council GPFS adapters.
 *
 * Adapters provide metadata + layout anchors and may use the generic helpers
 * here for unit detection, natural keys, measure mapping and non-additive
 * rules. A layout that does not fit calls the adapter's `parse` hook; the
 * engine never guesses a missing printed value or a COFOG/funding mapping.
 */
export interface GpfsMeta {
  id: string;
  name: string;
  publisher: string;
  reportingUrl: string;
  licence: string;
  fiscalYear: string;
  dataQualityFlag: string;
  sourceDataset: string;
  jurisdiction?: string;
  deliveryEntity: string;
}

export function gpfsNaturalKey(
  sourceId: string,
  documentUrl: string,
  lineItem: string,
  fiscalYear: string,
): string {
  return `${sourceId}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

export function gpfsUnitLabel(unit: MoneyUnitKind): string {
  switch (unit) {
    case 'dollars':
      return 'AUD_dollars';
    case 'thousands':
      return 'AUD_thousands';
    case 'millions':
      return 'AUD_millions';
    case 'billions':
      return 'AUD_billions';
  }
}

export function gpfsFundingSource(
  section: 'revenue' | 'expenses' | 'result',
  potentialDoubleCount: boolean,
  key: string,
): string {
  if (potentialDoubleCount) return 'Government grants and contributions';
  if (key === 'total_revenue')
    return 'Council total revenue (own-source plus government grants and contributions)';
  if (section === 'revenue') return 'Council own-source revenue';
  if (section === 'expenses') return 'Council expenditure';
  return 'Council result';
}

export function detectGpfsUnit(samples: readonly string[]) {
  return detectMoneyUnit(samples);
}

export function gpfsAmountToCents(value: number, unit: MoneyUnitKind): number {
  return moneyToCents(value, unit);
}

export interface GpfsConnectorParts {
  meta: GpfsMeta;
  fetch: () => Promise<RawRecord[]>;
  transform: (raw: readonly RawRecord[]) => SpendingRecord[];
  notes: string;
  status?: 'active' | 'degraded' | 'stub';
  metadata?: ConnectorRunMetadata;
}

export function createGpfsConnector(parts: GpfsConnectorParts): Connector {
  return {
    id: parts.meta.id,
    name: parts.meta.name,
    publisher: parts.meta.publisher,
    source_url: parts.meta.reportingUrl,
    status: parts.status ?? 'active',
    jurisdiction_level: 'local',
    license: parts.meta.licence,
    notes: parts.notes,
    fetch: parts.fetch,
    transform: parts.transform,
    metadata: parts.metadata ?? {
      lastFetchedAt: null,
      recordsIngested: 0,
      errors: [],
      warnings: [],
    },
  };
}

export const GPFS_AGGREGATION_ROLE = 'agency_detail' as const;
export const GPFS_NON_ADDITIVE_NOTE =
  'non-additive agency detail; never summed with another council or state row';
