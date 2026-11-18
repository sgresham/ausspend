import type { TradeDataQualityFlag, TradeRecordDocument } from '../../../models/trade-record.js';
import {
  OECD_ITIC_AGENCY,
  OECD_ITIC_BASE_URL,
  OECD_ITIC_DATAFLOW,
  OECD_ITIC_DEFAULT_YEARS,
  OECD_ITIC_FREQ,
  OECD_ITIC_MEASURE,
  OECD_ITIC_PRODUCT_TYPE,
  OECD_ITIC_REF_AREA,
  OECD_ITIC_SANITY_TARGETS,
  OECD_ITIC_SANITY_TOLERANCE,
  OECD_ITIC_SOURCE_DATASET,
  OECD_ITIC_TOTAL_COMMODITY,
  OECD_ITIC_UNIT_MEASURE,
  OECD_ITIC_VERSION,
  OECD_ITIC_WORLD,
} from './meta.js';

export type OecdIticRecordInput = Omit<TradeRecordDocument, 'created_at' | 'updated_at'>;

export interface SdmxDimensionValue {
  id: string;
  name?: string;
  names?: Record<string, string>;
}

export interface SdmxDimension {
  id: string;
  values: SdmxDimensionValue[];
}

export interface SdmxDataStructure {
  dimensions: {
    series: SdmxDimension[];
    observation: SdmxDimension[];
  };
  attributes?: {
    dataSet?: SdmxDimension[];
    series?: SdmxDimension[];
    observation?: SdmxDimension[];
  };
}

export interface SdmxDataJson {
  data: {
    dataSets: Array<{
      series: Record<
        string,
        { observations: Record<string, Array<number | string | null | undefined>> }
      >;
    }>;
    structure: SdmxDataStructure;
  };
}

export interface OecdIticParseOptions {
  sourceDate: string;
  /** Exact SDMX query URL that produced this response. */
  sourceUrl: string;
}

function dimensionIndex(structure: SdmxDataStructure, id: string): number {
  const index = structure.dimensions.series.findIndex((dimension) => dimension.id === id);
  if (index < 0) throw new Error(`OECD ITIC response has no ${id} dimension`);
  return index;
}

function valueAt(dimension: SdmxDimension, seriesKey: string, index: number): SdmxDimensionValue {
  const position = Number(seriesKey.split(':')[index]);
  if (!Number.isInteger(position) || position < 0 || position >= dimension.values.length) {
    throw new Error(`series key ${seriesKey} has no value for ${dimension.id}`);
  }
  return dimension.values[position]!;
}

/** Observation attributes follow the value in the SDMX-JSON observation array. */
function observationAttributeIndex(structure: SdmxDataStructure, id: string): number | null {
  const attributes = structure.attributes?.observation ?? [];
  const index = attributes.findIndex((attribute) => attribute.id === id);
  return index < 0 ? null : index;
}

function observationAttribute(
  structure: SdmxDataStructure,
  observation: Array<number | string | null | undefined>,
  id: string,
): string | null {
  const index = observationAttributeIndex(structure, id);
  if (index === null) return null;
  const attribute = structure.attributes!.observation![index]!;
  const position = observation[1 + index];
  if (typeof position !== 'number') return null;
  return attribute.values[position]?.id ?? null;
}

/**
 * Preserve the source's observed/derived distinction. A model-based,
 * interpolated, derived or adjusted figure is never relabelled observed.
 *
 * - METHODOLOGY_TYPE=ME / IE / DE → `estimated`
 * - METHODOLOGY_TYPE=AD          → `provisional` (adjusted, not directly reported)
 * - METHODOLOGY_TYPE=AG          → `observed` when OBS_STATUS is normal (A)
 * - OBS_STATUS=I                 → `estimated` regardless of methodology
 */
export function deriveQualityFlag(
  obsStatus: string | null,
  methodology: string | null,
): TradeDataQualityFlag {
  if (obsStatus === 'I') return 'estimated';
  switch (methodology) {
    case 'ME':
    case 'IE':
    case 'DE':
      return 'estimated';
    case 'AD':
      return 'provisional';
    case 'AG':
      return 'observed';
    default:
      return 'provisional';
  }
}

/** HS 2017 at 4 digits: `HS17_0101` → `0101`. Totals have no code. */
export function commodityCodeFromId(id: string): string | undefined {
  if (!id.startsWith('HS17_')) return undefined;
  const code = id.slice('HS17_'.length);
  return /^\d{4}$/.test(code) ? code : undefined;
}

export function commodityNameFromValue(value: SdmxDimensionValue): string {
  if (value.id === OECD_ITIC_TOTAL_COMMODITY) return 'Total - all products';
  return value.name ?? value.names?.en ?? value.id;
}

/**
 * Parse one OECD ITIC SDMX data response for Australia.
 *
 * The reference area is the importer (Australia) and the counterpart area is
 * the exporter, so every row is an `import` CIF/FOB margin. `amount_cents` is 0
 * because a margin is a percentage, not a monetary amount; `margin_percent`
 * carries the published value and is never summed with `trade_value` rows.
 */
export function parseIticData(
  json: SdmxDataJson,
  options: OecdIticParseOptions,
): OecdIticRecordInput[] {
  const dataSet = json.data.dataSets[0];
  if (!dataSet) throw new Error('OECD ITIC response has no dataSets');
  const structure = json.data.structure;
  if (!structure) throw new Error('OECD ITIC response has no structure');

  const refArea = structure.dimensions.series.find((entry) => entry.id === 'REF_AREA');
  const counterpart = structure.dimensions.series.find((entry) => entry.id === 'COUNTERPART_AREA');
  const measure = structure.dimensions.series.find((entry) => entry.id === 'MEASURE');
  const productType = structure.dimensions.series.find((entry) => entry.id === 'PRODUCT_TYPE');
  const commodity = structure.dimensions.series.find((entry) => entry.id === 'COMM_HS2017');
  const frequency = structure.dimensions.series.find((entry) => entry.id === 'FREQ');
  const unitMeasure = structure.dimensions.series.find((entry) => entry.id === 'UNIT_MEASURE');
  const timePeriod = structure.dimensions.observation.find((entry) => entry.id === 'TIME_PERIOD');
  if (
    !refArea ||
    !counterpart ||
    !measure ||
    !productType ||
    !commodity ||
    !frequency ||
    !unitMeasure ||
    !timePeriod
  ) {
    throw new Error('OECD ITIC response is missing a required dimension');
  }

  const refAreaIndex = dimensionIndex(structure, 'REF_AREA');
  const counterpartIndex = dimensionIndex(structure, 'COUNTERPART_AREA');
  const measureIndex = dimensionIndex(structure, 'MEASURE');
  const productTypeIndex = dimensionIndex(structure, 'PRODUCT_TYPE');
  const commodityIndex = dimensionIndex(structure, 'COMM_HS2017');
  const frequencyIndex = dimensionIndex(structure, 'FREQ');
  const unitMeasureIndex = dimensionIndex(structure, 'UNIT_MEASURE');

  const records: OecdIticRecordInput[] = [];
  for (const [seriesKey, series] of Object.entries(dataSet.series)) {
    const ref = valueAt(refArea, seriesKey, refAreaIndex).id;
    const measureId = valueAt(measure, seriesKey, measureIndex).id;
    const productTypeId = valueAt(productType, seriesKey, productTypeIndex).id;
    const frequencyId = valueAt(frequency, seriesKey, frequencyIndex).id;
    const unitId = valueAt(unitMeasure, seriesKey, unitMeasureIndex).id;
    if (
      ref !== OECD_ITIC_REF_AREA ||
      measureId !== OECD_ITIC_MEASURE ||
      productTypeId !== OECD_ITIC_PRODUCT_TYPE ||
      frequencyId !== OECD_ITIC_FREQ ||
      unitId !== OECD_ITIC_UNIT_MEASURE
    ) {
      continue;
    }

    const counterpartValue = valueAt(counterpart, seriesKey, counterpartIndex);
    const commodityValue = valueAt(commodity, seriesKey, commodityIndex);
    if (
      counterpartValue.id !== OECD_ITIC_WORLD &&
      commodityValue.id !== OECD_ITIC_TOTAL_COMMODITY
    ) {
      // Only the World product detail and the per-partner total rows are
      // ingested; individual partner × product rows would duplicate the same
      // analytical measure at a lower level and are not needed here.
      continue;
    }

    for (const [observationIndex, observation] of Object.entries(series.observations)) {
      const value = observation[0];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const period = timePeriod.values[Number(observationIndex)]?.id;
      if (!period) throw new Error(`observation index ${observationIndex} has no TIME_PERIOD`);

      const obsStatus = observationAttribute(structure, observation, 'OBS_STATUS');
      const methodology = observationAttribute(structure, observation, 'METHODOLOGY_TYPE');
      const commodityCode = commodityCodeFromId(commodityValue.id);

      records.push({
        trade_flow: 'import',
        measure_type: 'cif_fob_margin',
        commodity_name: commodityNameFromValue(commodityValue),
        ...(commodityCode ? { commodity_code: commodityCode } : {}),
        partner_country: counterpartValue.id,
        jurisdiction_level: 'federal',
        location: { granularity: 'national' },
        // A CIF/FOB margin is a percentage of CIF value, not a dollar amount.
        amount_cents: 0,
        margin_percent: value,
        financial_year: period,
        time_period: period,
        source_dataset: OECD_ITIC_SOURCE_DATASET,
        source_url: options.sourceUrl,
        source_date: options.sourceDate,
        data_quality_flag: deriveQualityFlag(obsStatus, methodology),
      });
    }
  }
  return records;
}

/** Build the exact SDMX data query URL for Australia. */
export function oecdIticDataUrl(options: {
  year: string;
  counterpartArea: string;
  commodity: string;
}): string {
  const key = [
    OECD_ITIC_REF_AREA,
    options.counterpartArea,
    OECD_ITIC_MEASURE,
    OECD_ITIC_PRODUCT_TYPE,
    options.commodity,
    OECD_ITIC_FREQ,
    OECD_ITIC_UNIT_MEASURE,
  ].join('.');
  return (
    `${OECD_ITIC_BASE_URL}/data/${OECD_ITIC_AGENCY},${OECD_ITIC_DATAFLOW},${OECD_ITIC_VERSION}/` +
    `${key}?startPeriod=${options.year}&endPeriod=${options.year}&format=jsondata`
  );
}

/** Request plan used by the client and by tests. */
export function oecdIticRequestPlan(
  years: readonly string[] = OECD_ITIC_DEFAULT_YEARS,
): Array<{ year: string; counterpartArea: string; commodity: string; url: string }> {
  const plan: Array<{ year: string; counterpartArea: string; commodity: string; url: string }> = [];
  for (const year of years) {
    plan.push({
      year,
      counterpartArea: '',
      commodity: OECD_ITIC_TOTAL_COMMODITY,
      url: oecdIticDataUrl({ year, counterpartArea: '', commodity: OECD_ITIC_TOTAL_COMMODITY }),
    });
  }
  for (const year of Object.keys(OECD_ITIC_SANITY_TARGETS)) {
    plan.push({
      year,
      counterpartArea: OECD_ITIC_WORLD,
      commodity: '',
      url: oecdIticDataUrl({ year, counterpartArea: OECD_ITIC_WORLD, commodity: '' }),
    });
  }
  return plan;
}

export interface OecdIticSanityResult {
  year: string;
  expected_percent: number;
  observed_unweighted_mean_percent: number;
  tolerance_percent: number;
  rows: number;
  matched: boolean;
  method: 'unweighted_mean_over_hs4_world_products';
  note: string;
}

/**
 * Sanity flag for the requested Australia 2019 ≈ 3.5% / 2022 ≈ 6.4% check.
 *
 * ITIC carries no trade values, so a CIF-import-value-weighted aggregate cannot
 * be computed from this dataflow. This function deliberately uses the explicit,
 * reproducible unweighted mean over the World HS 4-digit product margins and
 * returns `matched: false` rather than bending a value toward the headline.
 */
export function sanityCheckAustraliaMargins(
  records: readonly OecdIticRecordInput[],
  tolerance = OECD_ITIC_SANITY_TOLERANCE,
): OecdIticSanityResult[] {
  return Object.entries(OECD_ITIC_SANITY_TARGETS).map(([year, expected]) => {
    const values = records
      .filter(
        (record) =>
          record.measure_type === 'cif_fob_margin' &&
          record.trade_flow === 'import' &&
          record.partner_country === OECD_ITIC_WORLD &&
          record.commodity_code !== undefined &&
          record.financial_year === year &&
          typeof record.margin_percent === 'number',
      )
      .map((record) => record.margin_percent as number);
    const mean =
      values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const matched = values.length > 0 && Math.abs(mean - expected) <= tolerance;
    return {
      year,
      expected_percent: expected,
      observed_unweighted_mean_percent: Number(mean.toFixed(4)),
      tolerance_percent: tolerance,
      rows: values.length,
      matched,
      method: 'unweighted_mean_over_hs4_world_products',
      note: matched
        ? 'Unweighted HS4 mean is within tolerance of the published headline.'
        : 'Headline is a CIF-import-value-weighted aggregate; ITIC has no trade values, so the unweighted HS4 mean is flagged, not adjusted.',
    };
  });
}
