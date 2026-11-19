import Fuse from 'fuse.js';
import type { CoverageResponse, DataSource, FunctionDivision, RegionRef } from '../api/types';

export type DiscoveryKind = 'function' | 'region' | 'data_source' | 'soc';

export interface DiscoveryItem {
  /** Stable id with a kind prefix so Fuse never merges two domains. */
  id: string;
  kind: DiscoveryKind;
  label: string;
  secondary: string;
  href: string;
  /** Extra text (codes, ids, parent names) that still counts as a match. */
  keywords: string;
  /** Original object, used by callers that apply a filter instead of navigating. */
  functionCode?: string;
  region?: RegionRef;
}

export const DISCOVERY_GROUP_ORDER: DiscoveryKind[] = ['function', 'region', 'data_source', 'soc'];

export const DISCOVERY_GROUP_LABELS: Record<DiscoveryKind, string> = {
  function: 'Functions',
  region: 'Regions',
  data_source: 'Data sources',
  soc: 'State-owned entities',
};

export interface DiscoveryInputs {
  functions: FunctionDivision[];
  regions: RegionRef[];
  sources: DataSource[];
  coverage: CoverageResponse | null;
}

function regionHref(region: RegionRef): string {
  if (region.level === 'state') return `/states/${region.code}`;
  if (region.level === 'region') return `/regions/${region.slug ?? region._id}`;
  return `/regions/${region._id}`;
}

function sourceHref(sourceId: string): string {
  return `/data-sources#${sourceId}`;
}

/**
 * Build the bounded discovery index. It only contains taxonomy, the region
 * directory, the source register and the registered state-owned entities — it
 * never contains measure rows. `/api/soc` series and the 515k measure set are
 * deliberately not loaded here.
 */
export function buildDiscoveryItems({
  functions,
  regions,
  sources,
  coverage,
}: DiscoveryInputs): DiscoveryItem[] {
  const items: DiscoveryItem[] = [];

  for (const division of functions) {
    for (const fn of [division, ...division.subdivisions]) {
      items.push({
        id: `function:${fn.code}`,
        kind: 'function',
        label: `${fn.code} — ${fn.name}`,
        secondary: `COFOG ${fn.level}${fn.parent_code ? ` · parent ${fn.parent_code}` : ''}`,
        href: `/functions/${fn.code}`,
        keywords: [
          fn.code,
          fn.name,
          fn.level,
          fn.parent_code ?? '',
          'cofog function spending',
        ].join(' '),
        functionCode: fn.code,
      });
    }
  }

  for (const region of regions) {
    items.push({
      id: `region:${region._id}`,
      kind: 'region',
      label: `${region.code} — ${region.name}`,
      secondary: `${region.level}${region.parent_code ? ` · parent ${region.parent_code}` : ''}`,
      href: regionHref(region),
      keywords: [
        region.code,
        region.name,
        region.level,
        region.parent_code ?? '',
        region.slug ?? '',
        'region state council',
      ].join(' '),
      region,
    });
  }

  for (const source of sources) {
    items.push({
      id: `data_source:${source.source_id}`,
      kind: 'data_source',
      label: source.name,
      secondary: `${source.source_id} · ${source.publisher}`,
      href: sourceHref(source.source_id),
      keywords: [
        source.source_id,
        source.name,
        source.publisher,
        source.license,
        'data source register provenance',
      ].join(' '),
    });
  }

  for (const entity of coverage?.soc_ingestion?.entities ?? []) {
    items.push({
      id: `soc:${entity.source_id}`,
      kind: 'soc',
      label: entity.entity,
      secondary: `State-owned entity · source ${entity.source_id} · ${entity.records} row${
        entity.records === 1 ? '' : 's'
      }`,
      href: `/soc?entity=${encodeURIComponent(entity.entity)}`,
      keywords: [
        entity.entity,
        entity.source_id,
        entity.jurisdiction,
        'state owned corporation soc government owned corporation goc government trading enterprise gte entity statement',
      ].join(' '),
    });
  }

  return items;
}

export function createDiscoveryFuse(items: DiscoveryItem[], threshold = 0.4): Fuse<DiscoveryItem> {
  return new Fuse(items, {
    includeScore: true,
    ignoreLocation: true,
    threshold,
    minMatchCharLength: 2,
    shouldSort: true,
    keys: [
      { name: 'label', weight: 2 },
      { name: 'keywords', weight: 1.5 },
      { name: 'secondary', weight: 1 },
    ],
  });
}

export function searchDiscovery(
  fuse: Fuse<DiscoveryItem>,
  query: string,
  limit = 12,
): DiscoveryItem[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return fuse.search(trimmed, { limit }).map((result) => result.item);
}

/**
 * A looser second pass used only for a "did you mean" hint after the primary
 * search found nothing. It is still bounded to the same discovery index; the
 * caller passes a Fuse instance built with a higher threshold.
 */
export function suggestDiscovery(fuse: Fuse<DiscoveryItem>, query: string): DiscoveryItem | null {
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;
  const [first] = fuse.search(trimmed, { limit: 1 });
  return first?.item ?? null;
}

/**
 * Group ranked results by domain for labelled sections. Groups are ordered by
 * their best-ranked member, so a strong SOC match stays near the top while
 * each group keeps its own heading.
 */
export function groupDiscoveryResults(results: DiscoveryItem[]): Array<{
  kind: DiscoveryKind;
  label: string;
  items: DiscoveryItem[];
}> {
  const groups = new Map<DiscoveryKind, DiscoveryItem[]>();
  for (const item of results) {
    const list = groups.get(item.kind);
    if (list) list.push(item);
    else groups.set(item.kind, [item]);
  }

  return [...groups.entries()]
    .map(([kind, items]) => ({
      kind,
      label: DISCOVERY_GROUP_LABELS[kind],
      items,
      rank: results.findIndex((item) => item.kind === kind),
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        DISCOVERY_GROUP_ORDER.indexOf(a.kind) - DISCOVERY_GROUP_ORDER.indexOf(b.kind),
    )
    .map(({ kind, label, items }) => ({ kind, label, items }));
}
