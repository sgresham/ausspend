import type { RequestHandler } from 'express';
import {
  SYDNEY_WATER_CAVEAT,
  SYDNEY_WATER_ENTITY,
  SYDNEY_WATER_ID,
  SYDNEY_WATER_JURISDICTION,
  SYDNEY_WATER_NAME,
  SYDNEY_WATER_SOURCE_URL,
  SYDNEY_WATER_UNIT,
  SYDNEY_WATER_UNIT_LABEL,
  SYDNEY_WATER_UNIT_TO_CENTS,
  WATERNSW_CAVEAT,
  WATERNSW_ENTITY,
  WATERNSW_ID,
  WATERNSW_JURISDICTION,
  WATERNSW_NAME,
  WATERNSW_SOURCE_URL,
  WATERNSW_UNIT,
  WATERNSW_UNIT_LABEL,
  WATERNSW_UNIT_TO_CENTS,
} from '../connectors/index.js';
import { DeferredSocDocumentModel, MeasureModel } from '../models/index.js';

/**
 * GET /api/soc — entity-level State Owned Corporation statement lines.
 *
 * This is a separate layer from government program spending and from the PNFC
 * sector benchmark. It returns published rows only and computes **no total**:
 * statement lines overlap (total revenue includes separately shown grants,
 * total expenses includes employee/depreciation/transfer lines), so summing
 * them is invalid. Rows flagged `potential_double_count` name a government
 * agency or a government contribution and must never be added to government
 * program spending. Each SOC entity (Sydney Water, WaterNSW) is a separate
 * source and is never summed with the other.
 */

const SOC_SOURCES = [
  {
    source_id: SYDNEY_WATER_ID,
    name: SYDNEY_WATER_NAME,
    entity: SYDNEY_WATER_ENTITY,
    jurisdiction: SYDNEY_WATER_JURISDICTION,
    discovery_page: SYDNEY_WATER_SOURCE_URL,
    unit: SYDNEY_WATER_UNIT,
    unit_label: SYDNEY_WATER_UNIT_LABEL,
    unit_to_cents: SYDNEY_WATER_UNIT_TO_CENTS,
    caveat: SYDNEY_WATER_CAVEAT,
  },
  {
    source_id: WATERNSW_ID,
    name: WATERNSW_NAME,
    entity: WATERNSW_ENTITY,
    jurisdiction: WATERNSW_JURISDICTION,
    discovery_page: WATERNSW_SOURCE_URL,
    unit: WATERNSW_UNIT,
    unit_label: WATERNSW_UNIT_LABEL,
    unit_to_cents: WATERNSW_UNIT_TO_CENTS,
    caveat: WATERNSW_CAVEAT,
  },
] as const;

export const getSoc: RequestHandler = async (req, res) => {
  const requestedYear =
    typeof req.query.fiscal_year === 'string' && /^\d{4}-\d{2}$/.test(req.query.fiscal_year)
      ? req.query.fiscal_year
      : null;
  const requestedSource =
    typeof req.query.source_id === 'string' && req.query.source_id.length > 0
      ? req.query.source_id
      : null;
  const requestedEntity =
    typeof req.query.entity === 'string' && req.query.entity.length > 0 ? req.query.entity : null;

  const baseQuery: Record<string, unknown> = { jurisdiction_level: 'soc' };
  if (requestedSource) baseQuery.source_id = requestedSource;
  if (requestedEntity) baseQuery.delivery_entity = requestedEntity;

  const years = (await MeasureModel.distinct('fiscal_year', baseQuery)) as string[];
  years.sort();
  const fiscalYear = requestedYear ?? years.at(-1) ?? null;

  const query = { ...baseQuery, ...(fiscalYear ? { fiscal_year: fiscalYear } : {}) };
  const rows = await MeasureModel.find(query).sort({ delivery_entity: 1, soc_line_item: 1 }).lean();

  const series = rows.map((row) => ({
    id: row._id.toString(),
    source_id: row.source_id,
    source_url: row.source_url,
    source_dataset: row.source_dataset ?? null,
    fiscal_year: row.fiscal_year,
    jurisdiction_level: 'soc' as const,
    jurisdiction: row.jurisdiction ?? SYDNEY_WATER_JURISDICTION,
    delivery_entity: row.delivery_entity ?? SYDNEY_WATER_ENTITY,
    funding_source: row.funding_source ?? null,
    soc_line_item: row.soc_line_item ?? null,
    soc_line_label: row.soc_line_label ?? row.project_name ?? null,
    soc_unit: row.soc_unit ?? null,
    measure_type: row.measure_type,
    amount_cents: row.amount_cents,
    potential_double_count: row.potential_double_count ?? false,
    verified: row.verified,
    data_quality_flag: row.data_quality_flag ?? null,
    extraction_confidence: row.extraction_confidence ?? null,
    aggregation_role: row.aggregation_role ?? null,
    ...(row.location?.state ? { location_state: row.location.state } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
  }));

  const byLine: Record<string, number> = {};
  const byEntity: Record<string, number> = {};
  let doubleCountRows = 0;
  for (const row of series) {
    const line = row.soc_line_item ?? 'unknown';
    byLine[line] = (byLine[line] ?? 0) + 1;
    byEntity[row.delivery_entity] = (byEntity[row.delivery_entity] ?? 0) + 1;
    if (row.potential_double_count) doubleCountRows += 1;
  }

  // Registered SOC entities stay selectable even before they have rows, so
  // Sydney Water and WaterNSW are always distinguishable in the UI.
  const entities = [
    ...new Set([
      ...SOC_SOURCES.map((source) => source.entity),
      ...series.map((row) => row.delivery_entity),
    ]),
  ].sort();
  const sources = SOC_SOURCES.map((source) => ({
    ...source,
    jurisdiction_level: 'soc' as const,
    label: 'SOC entity statement — never add to government program spending',
    records: series.filter((row) => row.source_id === source.source_id).length,
  }));
  // Preserve the single-source shape: the requested source/entity wins, then
  // the first registered SOC source. The `sources` array is the full register.
  const source =
    sources.find((entry) => entry.source_id === requestedSource) ??
    (requestedEntity ? sources.find((entry) => entry.entity === requestedEntity) : undefined) ??
    sources[0]!;

  const deferred = await DeferredSocDocumentModel.find({ status: 'deferred' })
    .sort({ discovered_at: -1 })
    .lean();

  res.set('Cache-Control', 'no-store');
  res.json({
    source,
    sources,
    fiscal_years: years,
    entities,
    series,
    deferred_documents: deferred.map((entry) => ({
      source_id: entry.source_id,
      entity: entry.entity,
      jurisdiction: entry.jurisdiction,
      fiscal_year: entry.fiscal_year ?? null,
      title: entry.title,
      document_url: entry.document_url,
      sha256: entry.sha256 ?? null,
      reason: entry.reason,
      discovered_at: entry.discovered_at,
      status: entry.status,
    })),
    counts: {
      series: series.length,
      by_line: byLine,
      by_entity: byEntity,
      potential_double_count: doubleCountRows,
      deferred_documents: deferred.length,
    },
    note: 'Entity-level SOC statement lines for separate state-owned corporations (Sydney Water and WaterNSW). No total is computed here and the entities are never summed with each other: total revenue already includes the separately shown government grants, total expenses already includes employee, depreciation/amortisation and transfer lines, and no SOC value may be added to government program spending, the PNFC benchmark, or another SOC line. Every row is provisional and unverified until a human spot-check.',
  });
};
