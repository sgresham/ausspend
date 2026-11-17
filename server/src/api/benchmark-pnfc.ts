import type { RequestHandler } from 'express';
import {
  ABS_GFS_PNFC_BENCHMARK_CAVEAT,
  ABS_GFS_PNFC_DATASET,
  ABS_GFS_PNFC_ID,
  ABS_GFS_PNFC_NAME,
  ABS_GFS_PNFC_RELEASE_URL,
  ABS_GFS_PNFC_UNIT,
  ABS_GFS_PNFC_UNIT_TO_CENTS,
} from '../connectors/abs-gfs-pnfc.js';
import { MeasureModel } from '../models/index.js';

const JURISDICTION_ORDER: Record<string, number> = { Australia: 0 };

function jurisdictionRank(jurisdiction: string | undefined): number {
  if (!jurisdiction) return 99;
  return JURISDICTION_ORDER[jurisdiction] ?? 1;
}

/**
 * GET /api/benchmark/pnfc — ABS GFS Public Non-Financial Corporations sector
 * benchmark.
 *
 * Every amount is a published official ABS aggregate from the nine official
 * PNFC XLSX data cubes (Australia all levels + the eight states/territories).
 * The endpoint never computes or returns a combined total: no sum across
 * jurisdictions, no sum of revenue and expense, and no addition to
 * SOC/entity/government/charity/project data. Generic spending/search queries
 * exclude `aggregation_role=benchmark` deliberately.
 */
export const getPnfcBenchmark: RequestHandler = async (req, res) => {
  const requestedYear =
    typeof req.query.fiscal_year === 'string' && /^\d{4}-\d{2}$/.test(req.query.fiscal_year)
      ? req.query.fiscal_year
      : null;
  const requestedFlow =
    req.query.flow === 'revenue' || req.query.flow === 'expense' ? req.query.flow : null;
  const requestedJurisdiction =
    typeof req.query.jurisdiction === 'string' && req.query.jurisdiction.length > 0
      ? req.query.jurisdiction
      : null;

  const years = (await MeasureModel.distinct('fiscal_year', {
    source_id: ABS_GFS_PNFC_ID,
    aggregation_role: 'benchmark',
  })) as string[];
  years.sort();
  const fiscalYear = requestedYear ?? years.at(-1) ?? null;

  const query: Record<string, unknown> = {
    source_id: ABS_GFS_PNFC_ID,
    aggregation_role: 'benchmark',
  };
  if (fiscalYear) query.fiscal_year = fiscalYear;
  if (requestedFlow) query.gfs_flow = requestedFlow;
  if (requestedJurisdiction) query.jurisdiction = requestedJurisdiction;

  const rows = await MeasureModel.find(query).lean();

  const series = rows
    .map((row) => ({
      id: row._id.toString(),
      gfs_flow: row.gfs_flow ?? null,
      gfs_line_item: row.gfs_line_item ?? null,
      gfs_line_label: row.gfs_line_label ?? null,
      jurisdiction_level: 'pnfc' as const,
      jurisdiction: row.jurisdiction ?? 'Australia',
      jurisdiction_name:
        row.jurisdiction === 'Australia' ? 'Australia (all levels)' : (row.jurisdiction ?? ''),
      ...(row.location?.state ? { location_state: row.location.state } : {}),
      amount_cents: row.amount_cents,
      fiscal_year: row.fiscal_year,
      verified: row.verified,
      aggregation_role: row.aggregation_role,
      ...(row.data_quality_flag ? { data_quality_flag: row.data_quality_flag } : {}),
      source_id: row.source_id,
      source_url: row.source_url,
      ...(row.notes ? { notes: row.notes } : {}),
    }))
    .sort((a, b) => {
      const flow = String(a.gfs_flow).localeCompare(String(b.gfs_flow));
      if (flow !== 0) return flow;
      const jurisdiction = jurisdictionRank(a.jurisdiction) - jurisdictionRank(b.jurisdiction);
      if (jurisdiction !== 0) return jurisdiction;
      return a.jurisdiction.localeCompare(b.jurisdiction);
    });

  const byFlow: Record<string, number> = {};
  const byJurisdiction: Record<string, number> = {};
  for (const entry of series) {
    const flow = entry.gfs_flow ?? 'unknown';
    byFlow[flow] = (byFlow[flow] ?? 0) + 1;
    byJurisdiction[entry.jurisdiction] = (byJurisdiction[entry.jurisdiction] ?? 0) + 1;
  }
  const jurisdictions = [...new Set(series.map((entry) => entry.jurisdiction))]
    .sort((a, b) => jurisdictionRank(a) - jurisdictionRank(b) || a.localeCompare(b))
    .map((code) => ({
      code,
      name: code === 'Australia' ? 'Australia (all levels)' : code,
      level: 'pnfc' as const,
    }));

  res.set('Cache-Control', 'no-store');
  res.json({
    source: {
      source_id: ABS_GFS_PNFC_ID,
      name: ABS_GFS_PNFC_NAME,
      dataset: ABS_GFS_PNFC_DATASET,
      source_url: ABS_GFS_PNFC_RELEASE_URL,
      catalogue_url: ABS_GFS_PNFC_RELEASE_URL,
      fiscal_year: fiscalYear,
      unit: ABS_GFS_PNFC_UNIT,
      unit_to_cents: ABS_GFS_PNFC_UNIT_TO_CENTS,
      caveat: ABS_GFS_PNFC_BENCHMARK_CAVEAT,
      label: 'Sector aggregate — never add to project/entity data',
    },
    fiscal_years: years,
    flows: ['revenue', 'expense'],
    jurisdictions,
    series,
    counts: { series: series.length, by_flow: byFlow, by_jurisdiction: byJurisdiction },
    note: 'Each value is a published ABS GFS Public Non-Financial Corporations aggregate from an official annual XLSX data cube. This is a sector aggregate — never add it to project/entity data. No total is computed here: values are never summed across jurisdictions, across revenue/expense flows, or with SOC/government/charity data.',
  });
};
