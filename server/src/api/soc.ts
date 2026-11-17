import type { RequestHandler } from 'express';
import {
  ESSENTIAL_ENERGY_CAVEAT,
  ESSENTIAL_ENERGY_ENTITY,
  ESSENTIAL_ENERGY_ID,
  ESSENTIAL_ENERGY_JURISDICTION,
  ESSENTIAL_ENERGY_NAME,
  ESSENTIAL_ENERGY_SOURCE_URL,
  ESSENTIAL_ENERGY_UNIT,
  ESSENTIAL_ENERGY_UNIT_LABEL,
  ESSENTIAL_ENERGY_UNIT_TO_CENTS,
  FORESTRY_CORPORATION_CAVEAT,
  FORESTRY_CORPORATION_ENTITY,
  FORESTRY_CORPORATION_ID,
  FORESTRY_CORPORATION_JURISDICTION,
  FORESTRY_CORPORATION_NAME,
  FORESTRY_CORPORATION_SOURCE_URL,
  FORESTRY_CORPORATION_UNIT,
  FORESTRY_CORPORATION_UNIT_LABEL,
  FORESTRY_CORPORATION_UNIT_TO_CENTS,
  HUNTER_WATER_CAVEAT,
  HUNTER_WATER_ENTITY,
  HUNTER_WATER_ID,
  HUNTER_WATER_JURISDICTION,
  HUNTER_WATER_NAME,
  HUNTER_WATER_SOURCE_URL,
  HUNTER_WATER_UNIT,
  HUNTER_WATER_UNIT_LABEL,
  HUNTER_WATER_UNIT_TO_CENTS,
  LANDCOM_CAVEAT,
  LANDCOM_ENTITY,
  LANDCOM_ID,
  LANDCOM_JURISDICTION,
  LANDCOM_NAME,
  LANDCOM_SOURCE_URL,
  LANDCOM_UNIT,
  LANDCOM_UNIT_LABEL,
  LANDCOM_UNIT_TO_CENTS,
  PORT_AUTHORITY_CAVEAT,
  PORT_AUTHORITY_ENTITY,
  PORT_AUTHORITY_ID,
  PORT_AUTHORITY_JURISDICTION,
  PORT_AUTHORITY_NAME,
  PORT_AUTHORITY_SOURCE_URL,
  PORT_AUTHORITY_UNIT,
  PORT_AUTHORITY_UNIT_LABEL,
  PORT_AUTHORITY_UNIT_TO_CENTS,
  SYDNEY_WATER_CAVEAT,
  SYDNEY_WATER_ENTITY,
  SYDNEY_WATER_ID,
  SYDNEY_WATER_JURISDICTION,
  SYDNEY_WATER_NAME,
  SYDNEY_WATER_SOURCE_URL,
  SYDNEY_WATER_UNIT,
  SYDNEY_WATER_UNIT_LABEL,
  SYDNEY_WATER_UNIT_TO_CENTS,
  SYDNEY_TRAINS_CAVEAT,
  SYDNEY_TRAINS_ENTITY,
  SYDNEY_TRAINS_ID,
  SYDNEY_TRAINS_JURISDICTION,
  SYDNEY_TRAINS_NAME,
  SYDNEY_TRAINS_SOURCE_URL,
  SYDNEY_TRAINS_UNIT,
  SYDNEY_TRAINS_UNIT_LABEL,
  SYDNEY_TRAINS_UNIT_TO_CENTS,
  NSW_TRAINLINK_CAVEAT,
  NSW_TRAINLINK_ENTITY,
  NSW_TRAINLINK_ID,
  NSW_TRAINLINK_JURISDICTION,
  NSW_TRAINLINK_NAME,
  NSW_TRAINLINK_SOURCE_URL,
  NSW_TRAINLINK_UNIT,
  NSW_TRAINLINK_UNIT_LABEL,
  NSW_TRAINLINK_UNIT_TO_CENTS,
  TAHE_CAVEAT,
  TAHE_ENTITY,
  TAHE_ID,
  TAHE_JURISDICTION,
  TAHE_NAME,
  TAHE_SOURCE_URL,
  TAHE_UNIT,
  TAHE_UNIT_LABEL,
  TAHE_UNIT_TO_CENTS,
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
 * program spending. Each SOC entity (Sydney Water, WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW, Landcom, Port Authority of NSW, TAHE, Sydney Trains, NSW TrainLink) is a separate
 * source and is never summed with the others.
 *
 * WaterNSW deep detail adds note-level components (`soc_note`,
 * `soc_component_of`, `soc_breakdown`). They are grouped for the UI but are
 * still non-additive: each component sums to its printed note subtotal, never
 * to the entity total. Counts are returned per section/note; no sum is
 * computed.
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
  {
    source_id: HUNTER_WATER_ID,
    name: HUNTER_WATER_NAME,
    entity: HUNTER_WATER_ENTITY,
    jurisdiction: HUNTER_WATER_JURISDICTION,
    discovery_page: HUNTER_WATER_SOURCE_URL,
    unit: HUNTER_WATER_UNIT,
    unit_label: HUNTER_WATER_UNIT_LABEL,
    unit_to_cents: HUNTER_WATER_UNIT_TO_CENTS,
    caveat: HUNTER_WATER_CAVEAT,
  },
  {
    source_id: ESSENTIAL_ENERGY_ID,
    name: ESSENTIAL_ENERGY_NAME,
    entity: ESSENTIAL_ENERGY_ENTITY,
    jurisdiction: ESSENTIAL_ENERGY_JURISDICTION,
    discovery_page: ESSENTIAL_ENERGY_SOURCE_URL,
    unit: ESSENTIAL_ENERGY_UNIT,
    unit_label: ESSENTIAL_ENERGY_UNIT_LABEL,
    unit_to_cents: ESSENTIAL_ENERGY_UNIT_TO_CENTS,
    caveat: ESSENTIAL_ENERGY_CAVEAT,
  },
  {
    source_id: FORESTRY_CORPORATION_ID,
    name: FORESTRY_CORPORATION_NAME,
    entity: FORESTRY_CORPORATION_ENTITY,
    jurisdiction: FORESTRY_CORPORATION_JURISDICTION,
    discovery_page: FORESTRY_CORPORATION_SOURCE_URL,
    unit: FORESTRY_CORPORATION_UNIT,
    unit_label: FORESTRY_CORPORATION_UNIT_LABEL,
    unit_to_cents: FORESTRY_CORPORATION_UNIT_TO_CENTS,
    caveat: FORESTRY_CORPORATION_CAVEAT,
  },
  {
    source_id: LANDCOM_ID,
    name: LANDCOM_NAME,
    entity: LANDCOM_ENTITY,
    jurisdiction: LANDCOM_JURISDICTION,
    discovery_page: LANDCOM_SOURCE_URL,
    unit: LANDCOM_UNIT,
    unit_label: LANDCOM_UNIT_LABEL,
    unit_to_cents: LANDCOM_UNIT_TO_CENTS,
    caveat: LANDCOM_CAVEAT,
  },
  {
    source_id: PORT_AUTHORITY_ID,
    name: PORT_AUTHORITY_NAME,
    entity: PORT_AUTHORITY_ENTITY,
    jurisdiction: PORT_AUTHORITY_JURISDICTION,
    discovery_page: PORT_AUTHORITY_SOURCE_URL,
    unit: PORT_AUTHORITY_UNIT,
    unit_label: PORT_AUTHORITY_UNIT_LABEL,
    unit_to_cents: PORT_AUTHORITY_UNIT_TO_CENTS,
    caveat: PORT_AUTHORITY_CAVEAT,
  },
  {
    source_id: TAHE_ID,
    name: TAHE_NAME,
    entity: TAHE_ENTITY,
    jurisdiction: TAHE_JURISDICTION,
    discovery_page: TAHE_SOURCE_URL,
    unit: TAHE_UNIT,
    unit_label: TAHE_UNIT_LABEL,
    unit_to_cents: TAHE_UNIT_TO_CENTS,
    caveat: TAHE_CAVEAT,
  },
  {
    source_id: SYDNEY_TRAINS_ID,
    name: SYDNEY_TRAINS_NAME,
    entity: SYDNEY_TRAINS_ENTITY,
    jurisdiction: SYDNEY_TRAINS_JURISDICTION,
    discovery_page: SYDNEY_TRAINS_SOURCE_URL,
    unit: SYDNEY_TRAINS_UNIT,
    unit_label: SYDNEY_TRAINS_UNIT_LABEL,
    unit_to_cents: SYDNEY_TRAINS_UNIT_TO_CENTS,
    caveat: SYDNEY_TRAINS_CAVEAT,
  },
  {
    source_id: NSW_TRAINLINK_ID,
    name: NSW_TRAINLINK_NAME,
    entity: NSW_TRAINLINK_ENTITY,
    jurisdiction: NSW_TRAINLINK_JURISDICTION,
    discovery_page: NSW_TRAINLINK_SOURCE_URL,
    unit: NSW_TRAINLINK_UNIT,
    unit_label: NSW_TRAINLINK_UNIT_LABEL,
    unit_to_cents: NSW_TRAINLINK_UNIT_TO_CENTS,
    caveat: NSW_TRAINLINK_CAVEAT,
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
    soc_section: row.soc_section ?? null,
    soc_note: row.soc_note ?? null,
    soc_component_of: row.soc_component_of ?? null,
    soc_breakdown: row.soc_breakdown ?? null,
    soc_printed_sign: row.soc_printed_sign ?? null,
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
  const bySection: Record<string, number> = {};
  const byNote: Record<string, number> = {};
  let doubleCountRows = 0;
  for (const row of series) {
    const line = row.soc_line_item ?? 'unknown';
    byLine[line] = (byLine[line] ?? 0) + 1;
    byEntity[row.delivery_entity] = (byEntity[row.delivery_entity] ?? 0) + 1;
    const section = row.soc_section ?? 'face_statement';
    bySection[section] = (bySection[section] ?? 0) + 1;
    const note = row.soc_note ?? 'Face statement';
    byNote[note] = (byNote[note] ?? 0) + 1;
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
      by_section: bySection,
      by_note: byNote,
      potential_double_count: doubleCountRows,
      deferred_documents: deferred.length,
    },
    note: 'Entity-level SOC statement lines for separate state-owned corporations (Sydney Water, WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW, Landcom, Port Authority of NSW, TAHE, Sydney Trains and NSW TrainLink). No total is computed here and the entities are never summed with each other: total revenue already includes the separately shown government grants, total expenses already includes employee, depreciation/amortisation and transfer lines, and no SOC value may be added to government program spending, the PNFC benchmark, or another SOC line. WaterNSW note-level rows (Notes 2, 4, 5, 6, 7, 8 and cash-flow capital expenditure) are components of their printed subtotals, never additional spending; `soc_component_of` names the subtotal and `soc_printed_sign` preserves a printed deduction. Every row is provisional and unverified until a human spot-check.',
  });
};
