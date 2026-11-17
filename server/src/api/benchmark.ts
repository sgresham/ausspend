import type { RequestHandler } from 'express';
import {
  ABS_GFS_BENCHMARK_CAVEAT,
  ABS_GFS_DATASET,
  ABS_GFS_FUNCTION_NAMES,
  ABS_GFS_ID,
  ABS_GFS_KEY_TABLES_URL,
  ABS_GFS_NAME,
  ABS_GFS_RELEASE_URL,
  ABS_GFS_UNIT,
  ABS_GFS_UNIT_TO_CENTS,
} from '../connectors/abs-gfs.js';
import { FunctionModel, MeasureModel } from '../models/index.js';

const LEVEL_ORDER: Record<string, number> = { federal: 0, state: 1, local: 2 };
const JURISDICTION_ORDER: Record<string, number> = { Australia: 0 };

function levelRank(level: string | undefined): number {
  return level ? (LEVEL_ORDER[level] ?? 99) : 99;
}

function jurisdictionRank(jurisdiction: string | undefined): number {
  if (!jurisdiction) return 99;
  return JURISDICTION_ORDER[jurisdiction] ?? 1;
}

/**
 * GET /api/benchmark — the ABS GFS top-down COFOG-A expense benchmark.
 *
 * Every amount is a published official ABS aggregate from the annual XLSX
 * (Key Tables 9/10). The endpoint never computes or returns a combined total:
 * no sum across functions, levels or measures, and no addition to project data.
 * The generic spending/search endpoints exclude `aggregation_role=benchmark`
 * deliberately, so a benchmark cell can never be silently mixed into a project
 * total.
 */
export const getBenchmark: RequestHandler = async (req, res) => {
  const requestedYear =
    typeof req.query.fiscal_year === 'string' && /^\d{4}-\d{2}$/.test(req.query.fiscal_year)
      ? req.query.fiscal_year
      : null;
  const requestedFunction =
    typeof req.query.function === 'string' && /^(0[1-9]|10)\d?$/.test(req.query.function)
      ? req.query.function
      : null;

  const years = (await MeasureModel.distinct('fiscal_year', {
    source_id: ABS_GFS_ID,
    aggregation_role: 'benchmark',
  })) as string[];
  years.sort();
  const fiscalYear = requestedYear ?? years.at(-1) ?? null;

  const query: Record<string, unknown> = {
    source_id: ABS_GFS_ID,
    aggregation_role: 'benchmark',
  };
  if (fiscalYear) query.fiscal_year = fiscalYear;
  if (requestedFunction) query.function_code = requestedFunction;

  const rows = await MeasureModel.find(query).lean();
  const functionCodes = [
    ...new Set(rows.map((row) => row.function_code).filter(Boolean)),
  ] as string[];
  const functions = await FunctionModel.find({ code: { $in: functionCodes } }).lean();
  const functionNames = new Map(functions.map((fn) => [fn.code, fn.name]));

  const series = rows
    .map((row) => {
      const code = row.function_code ?? '';
      return {
        id: row._id.toString(),
        function_code: code,
        function_name: functionNames.get(code) ?? ABS_GFS_FUNCTION_NAMES[code] ?? code,
        jurisdiction_level: row.jurisdiction_level ?? 'other',
        jurisdiction: row.jurisdiction ?? 'Australia',
        jurisdiction_name:
          row.jurisdiction === 'Australia'
            ? 'Commonwealth'
            : (row.location?.state ?? row.jurisdiction ?? 'Australia'),
        amount_cents: row.amount_cents,
        fiscal_year: row.fiscal_year,
        verified: row.verified,
        ...(row.data_quality_flag ? { data_quality_flag: row.data_quality_flag } : {}),
        source_id: row.source_id,
        source_url: row.source_url,
        ...(row.notes ? { notes: row.notes } : {}),
      };
    })
    .sort((a, b) => {
      const level = levelRank(a.jurisdiction_level) - levelRank(b.jurisdiction_level);
      if (level !== 0) return level;
      const jurisdiction = jurisdictionRank(a.jurisdiction) - jurisdictionRank(b.jurisdiction);
      if (jurisdiction !== 0) return jurisdiction;
      const code = a.jurisdiction.localeCompare(b.jurisdiction);
      if (code !== 0) return code;
      return a.function_code.localeCompare(b.function_code);
    });

  const byLevel: Record<string, number> = {};
  for (const entry of series) {
    const key = entry.jurisdiction_level;
    byLevel[key] = (byLevel[key] ?? 0) + 1;
  }

  res.set('Cache-Control', 'no-store');
  res.json({
    source: {
      source_id: ABS_GFS_ID,
      name: ABS_GFS_NAME,
      dataset: ABS_GFS_DATASET,
      source_url: ABS_GFS_KEY_TABLES_URL,
      catalogue_url: ABS_GFS_RELEASE_URL,
      fiscal_year: fiscalYear,
      unit: ABS_GFS_UNIT,
      unit_to_cents: ABS_GFS_UNIT_TO_CENTS,
      caveat: ABS_GFS_BENCHMARK_CAVEAT,
    },
    fiscal_years: years,
    functions: [...functionCodes].sort().map((code) => ({
      code,
      name: functionNames.get(code) ?? ABS_GFS_FUNCTION_NAMES[code] ?? code,
    })),
    series,
    counts: { series: series.length, by_level: byLevel },
    note: 'Each value is a published ABS GFS COFOG-A aggregate from the official annual XLSX. No total is computed here: values are never summed across functions, levels of government or measure types, and never added to project data.',
  });
};
