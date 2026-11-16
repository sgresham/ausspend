import mongoose from 'mongoose';
import { regionSlug, type MeasureType } from '@ausspend/shared';
import { MeasureModel, RegionModel } from '../models/index.js';
import type { LeanRegion, RegionPayload } from './measure-summary.js';
import { serializeRegion } from './measure-summary.js';
import { sumCents } from './filters.js';

/**
 * Area contract C.
 *
 * A region slug/name resolves to a Region and produces one shared area profile.
 * The profile never adds local, state and federal money together: each panel
 * groups its own jurisdiction_level by measure_type and carries no
 * cross-level/cross-type total. PBS is a Commonwealth-wide panel, not a
 * Dubbo-specific row.
 */

export const AREA_CAUTION =
  'These panels are different levels of government. Local (Dubbo Regional Council), NSW-wide state, NSW-tagged federal and Commonwealth-wide PBS figures overlap and are NOT additive. Never sum across panels, jurisdiction levels or measure types.';

export const AREA_NOT_COVERED = {
  councils: [
    'Bathurst Regional Council — not covered (no connector)',
    'Orange City Council — not covered (no connector)',
    'Mid-Western Regional Council — not covered (no connector)',
    'All other NSW local councils — not covered (no connector)',
  ],
  states: [
    'VIC — not covered (stub)',
    'QLD — not covered (stub)',
    'WA — not covered (stub)',
    'SA — not covered (no connector)',
    'TAS — not covered (no connector)',
    'ACT — not covered (no connector)',
    'NT — not covered (no connector)',
  ],
} as const;

export interface AreaPanelTypeTotal {
  measure_type: MeasureType;
  count: number;
  total_cents: number;
}

export interface AreaPanel {
  key: 'local' | 'state_nsw' | 'federal_nsw_tagged' | 'commonwealth_pbs';
  label: string;
  description: string;
  jurisdiction_level: 'local' | 'state' | 'federal';
  count: number;
  by_measure_type: AreaPanelTypeTotal[];
  /** No total across measure types or levels is ever emitted. */
  total_cents: null;
}

export interface AreaProfile {
  area: RegionPayload & { slug: string };
  panels: AreaPanel[];
  caution: string;
  not_covered: { councils: readonly string[]; states: readonly string[] };
}

const HEX_OBJECT_ID = /^[a-f0-9]{24}$/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Resolve a 24-char _id exactly, or a slug/name/code case-insensitively. */
export async function resolveRegion(raw: string): Promise<LeanRegion | null> {
  const value = raw.trim();
  if (!value) return null;
  if (HEX_OBJECT_ID.test(value)) {
    return RegionModel.findById(new mongoose.Types.ObjectId(value)).lean<LeanRegion | null>();
  }
  const pattern = new RegExp(`^${escapeRegex(value)}$`, 'i');
  return RegionModel.findOne({
    $or: [{ code: pattern }, { name: pattern }],
  }).lean<LeanRegion | null>();
}

interface AreaQueries {
  local: Record<string, unknown>;
  state: Record<string, unknown>;
  federal: Record<string, unknown>;
  pbs: Record<string, unknown>;
  combined: Record<string, unknown>;
}

export function areaQueries(region: LeanRegion, parentStateCode = 'NSW'): AreaQueries {
  const local: Record<string, unknown> = {
    $or: [
      { region_id: region._id },
      { 'location.lga_name': new RegExp(`^${escapeRegex(region.name)}$`, 'i') },
    ],
  };
  const state: Record<string, unknown> = {
    jurisdiction_level: 'state',
    jurisdiction: parentStateCode,
  };
  const federal: Record<string, unknown> = {
    jurisdiction_level: 'federal',
    source_id: 'aus-tender',
    'location.state': parentStateCode,
  };
  const pbs: Record<string, unknown> = { source_id: 'data-gov-au-pbs' };
  return {
    local,
    state,
    federal,
    pbs,
    combined: { $or: [local, state, federal] },
  };
}

async function panelTypeTotals(
  query: Record<string, unknown>,
): Promise<{ count: number; by_measure_type: AreaPanelTypeTotal[] }> {
  const rows = await MeasureModel.find(query)
    .select({ amount_cents: 1, measure_type: 1 })
    .lean<Array<{ amount_cents: number; measure_type: MeasureType }>>();
  const byType = new Map<MeasureType, number[]>();
  for (const row of rows) {
    const amounts = byType.get(row.measure_type) ?? [];
    amounts.push(row.amount_cents);
    byType.set(row.measure_type, amounts);
  }
  return {
    count: rows.length,
    by_measure_type: [...byType.entries()]
      .map(([measureType, amounts]) => ({
        measure_type: measureType,
        count: amounts.length,
        total_cents: sumCents(amounts),
      }))
      .sort((a, b) => a.measure_type.localeCompare(b.measure_type)),
  };
}

/** Build the shared four-panel profile for a resolved sub-state region. */
export async function buildAreaProfile(region: LeanRegion): Promise<AreaProfile | null> {
  if (region.level !== 'region') return null;
  const parent = region.parent_code ?? 'NSW';
  const queries = areaQueries(region, parent);
  const [local, state, federal, pbs] = await Promise.all([
    panelTypeTotals(queries.local),
    panelTypeTotals(queries.state),
    panelTypeTotals(queries.federal),
    panelTypeTotals(queries.pbs),
  ]);

  const panels: AreaPanel[] = [
    {
      key: 'local',
      label: `${region.name} — local (Dubbo Regional Council)`,
      description: `Rows delivered by Dubbo Regional Council with location.lga_name ${region.name} or the Dubbo region_id. Local budgets are council measures, not state or federal spending.`,
      jurisdiction_level: 'local',
      count: local.count,
      by_measure_type: local.by_measure_type,
      total_cents: null,
    },
    {
      key: 'state_nsw',
      label: 'NSW-wide state rows (not Dubbo-specific)',
      description:
        'Rows with jurisdiction_level state and jurisdiction NSW. They are NSW-wide budget/actual measures and cannot be attributed to Dubbo without a published LGA split.',
      jurisdiction_level: 'state',
      count: state.count,
      by_measure_type: state.by_measure_type,
      total_cents: null,
    },
    {
      key: 'federal_nsw_tagged',
      label: 'Federal AusTender rows tagged NSW (not Dubbo-specific)',
      description:
        'AusTender contract rows whose location.state is NSW. They are NSW-tagged federal procurement, not a Dubbo council measure.',
      jurisdiction_level: 'federal',
      count: federal.count,
      by_measure_type: federal.by_measure_type,
      total_cents: null,
    },
    {
      key: 'commonwealth_pbs',
      label: 'Commonwealth-wide PBS (separate; not a Dubbo row)',
      description:
        'Portfolio Budget Statement line items are Commonwealth-wide entity/program tables. They are shown separately and are not Dubbo spending.',
      jurisdiction_level: 'federal',
      count: pbs.count,
      by_measure_type: pbs.by_measure_type,
      total_cents: null,
    },
  ];

  return {
    area: { ...serializeRegion(region), slug: regionSlug(region) },
    panels,
    caution: AREA_CAUTION,
    not_covered: AREA_NOT_COVERED,
  };
}

export function areaPanelQueries(region: LeanRegion, parentStateCode = 'NSW'): AreaQueries {
  return areaQueries(region, parentStateCode);
}
