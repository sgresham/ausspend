import type { TradeRecordDocument } from '../../../models/trade-record.js';
import { ABS_TRADE_DATA_QUALITY_FLAG, ABS_TRADE_SOURCE_DATASET } from './meta.js';

export type AbsTradeRecordInput = Omit<TradeRecordDocument, 'created_at' | 'updated_at'>;

export interface SdmxDimensionValue {
  id: string;
  name?: string;
}

export interface SdmxStructure {
  dimensions: {
    series: Array<{ id: string; values: SdmxDimensionValue[] }>;
    observation: Array<{ id: string; values: SdmxDimensionValue[] }>;
  };
  attributes?: {
    dataSet?: Array<{ id: string; values: Array<{ id?: string; value?: string }> }>;
    series?: Array<{ id: string; values: Array<{ id?: string; value?: string }> }>;
  };
}

export interface SdmxJson {
  data: {
    dataSets: Array<{
      series: Record<string, { observations: Record<string, Array<number | null | string>> }>;
    }>;
    structures: SdmxStructure[];
  };
}

export function financialYearForMonth(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new Error(`unexpected monthly TIME_PERIOD ${JSON.stringify(period)}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`invalid month in TIME_PERIOD ${period}`);
  if (month >= 7) return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  return `${year - 1}-${String(year % 100).padStart(2, '0')}`;
}

/** ABS financial-year labels use the 1 July start year: 2024 = 2024-25. */
export function financialYearForLabelYear(period: string): string {
  if (!/^\d{4}$/.test(period))
    throw new Error(`unexpected annual TIME_PERIOD ${JSON.stringify(period)}`);
  const year = Number(period);
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

function dimensionIndex(structure: SdmxStructure, id: string): number {
  const index = structure.dimensions.series.findIndex((dimension) => dimension.id === id);
  if (index < 0) throw new Error(`SDMX structure has no ${id} dimension`);
  return index;
}

function valueAt(
  structure: SdmxStructure,
  dimension: { id: string; values: SdmxDimensionValue[] },
  seriesKey: string,
  index: number,
): SdmxDimensionValue {
  const position = Number(seriesKey.split(':')[index]);
  if (!Number.isInteger(position) || position < 0 || position >= dimension.values.length) {
    throw new Error(`series key ${seriesKey} has no value for ${dimension.id}`);
  }
  return dimension.values[position]!;
}

function unitMultiplier(json: SdmxJson): number {
  const structure = json.data.structures[0];
  if (!structure) throw new Error('SDMX response has no structure');
  const attribute =
    structure.attributes?.dataSet?.find((entry) => entry.id === 'UNIT_MULT') ??
    structure.attributes?.series?.find((entry) => entry.id === 'UNIT_MULT');
  const raw = attribute?.values[0]?.id ?? attribute?.values[0]?.value;
  if (raw === undefined) throw new Error('SDMX response has no UNIT_MULT attribute');
  const multiplier = Number(raw);
  if (!Number.isInteger(multiplier) || multiplier < 0 || multiplier > 12) {
    throw new Error(`unsupported UNIT_MULT ${JSON.stringify(raw)}`);
  }
  return multiplier;
}

function unitMeasure(json: SdmxJson): string | null {
  const structure = json.data.structures[0];
  const attribute =
    structure?.attributes?.dataSet?.find((entry) => entry.id === 'UNIT_MEASURE') ??
    structure?.attributes?.series?.find((entry) => entry.id === 'UNIT_MEASURE');
  return attribute?.values[0]?.id ?? attribute?.values[0]?.value ?? null;
}

function toCents(value: number, multiplier: number): number {
  const cents = Math.round(Math.abs(value) * 10 ** multiplier * 100);
  if (!Number.isSafeInteger(cents)) throw new Error(`amount ${value} is not a safe cent value`);
  return cents;
}

function requireAUD(json: SdmxJson): void {
  const unit = unitMeasure(json);
  if (unit !== null && unit !== 'AUD') {
    throw new Error(`unexpected UNIT_MEASURE ${unit}; refusing to treat as Australian dollars`);
  }
}

function timeValues(json: SdmxJson): string[] {
  const structure = json.data.structures[0];
  if (!structure) throw new Error('SDMX response has no structure');
  const observation = structure.dimensions.observation.find((entry) => entry.id === 'TIME_PERIOD');
  if (!observation) throw new Error('SDMX response has no TIME_PERIOD dimension');
  return observation.values.map((value) => value.id);
}

export interface GoodsParseOptions {
  sourceDate: string;
  sourceUrl: string;
}

/** Parse ITGS current-price original monthly goods series into trade records. */
export function parseAbsGoods(json: SdmxJson, options: GoodsParseOptions): AbsTradeRecordInput[] {
  if (!Array.isArray(json.data.dataSets) || json.data.dataSets.length === 0) {
    throw new Error('ABS goods response has no dataSets');
  }
  const structure = json.data.structures[0];
  if (!structure) throw new Error('ABS goods response has no structure');
  requireAUD(json);

  const measureDim = structure.dimensions.series.find((entry) => entry.id === 'MEASURE');
  const itemDim = structure.dimensions.series.find((entry) => entry.id === 'DATA_ITEM');
  const tsestDim = structure.dimensions.series.find((entry) => entry.id === 'TSEST');
  const regionDim = structure.dimensions.series.find((entry) => entry.id === 'REGION');
  const freqDim = structure.dimensions.series.find((entry) => entry.id === 'FREQ');
  if (!measureDim || !itemDim || !tsestDim || !regionDim || !freqDim) {
    throw new Error('ABS goods response is missing a required dimension');
  }
  const measureIndex = dimensionIndex(structure, 'MEASURE');
  const itemIndex = dimensionIndex(structure, 'DATA_ITEM');
  const tsestIndex = dimensionIndex(structure, 'TSEST');
  const regionIndex = dimensionIndex(structure, 'REGION');
  const freqIndex = dimensionIndex(structure, 'FREQ');

  const multiplier = unitMultiplier(json);
  const times = timeValues(json);
  const records: AbsTradeRecordInput[] = [];

  for (const [seriesKey, series] of Object.entries(json.data.dataSets[0]!.series)) {
    const measure = valueAt(structure, measureDim, seriesKey, measureIndex).id;
    const item = valueAt(structure, itemDim, seriesKey, itemIndex);
    const tsest = valueAt(structure, tsestDim, seriesKey, tsestIndex).id;
    const region = valueAt(structure, regionDim, seriesKey, regionIndex).id;
    const freq = valueAt(structure, freqDim, seriesKey, freqIndex).id;
    if (measure !== 'M1' || tsest !== '10' || region !== 'AUS' || freq !== 'M') continue;
    // 170 is a derived balance, not an import or export value.
    if (item.id === '170') continue;

    const itemName = item.name ?? '';
    const direction = itemName.startsWith('Goods Credit')
      ? 'export'
      : itemName.startsWith('Goods Debit')
        ? 'import'
        : null;
    if (!direction) {
      throw new Error(`unmapped ITGS DATA_ITEM ${item.id} ${JSON.stringify(itemName)}`);
    }
    const commodityName = itemName.replace(/^Goods (?:Credit|Debit);\s*/, '').trim();
    if (!commodityName) throw new Error(`ITGS DATA_ITEM ${item.id} has no commodity name`);

    for (const [obsIndex, observation] of Object.entries(series.observations)) {
      const value = observation[0];
      if (typeof value !== 'number') continue;
      const period = times[Number(obsIndex)];
      if (!period) throw new Error(`observation index ${obsIndex} has no TIME_PERIOD`);
      records.push({
        trade_flow: direction,
        measure_type: 'trade_value',
        commodity_name: commodityName,
        commodity_code: item.id,
        jurisdiction_level: 'federal',
        location: { granularity: 'national' },
        amount_cents: toCents(value, multiplier),
        financial_year: financialYearForMonth(period),
        time_period: period,
        source_dataset: ABS_TRADE_SOURCE_DATASET,
        source_url: options.sourceUrl,
        source_date: options.sourceDate,
        data_quality_flag: ABS_TRADE_DATA_QUALITY_FLAG,
      });
    }
  }
  return records;
}

export interface ServicesParseOptions {
  sourceDate: string;
  sourceUrl: string;
}

/** Parse TRADE_SERV_CNTRY_FY total-services credits/debits for all countries. */
export function parseAbsServices(
  json: SdmxJson,
  options: ServicesParseOptions,
): AbsTradeRecordInput[] {
  if (!Array.isArray(json.data.dataSets) || json.data.dataSets.length === 0) {
    throw new Error('ABS services response has no dataSets');
  }
  const structure = json.data.structures[0];
  if (!structure) throw new Error('ABS services response has no structure');
  requireAUD(json);

  const directionDim = structure.dimensions.series.find((entry) => entry.id === 'EXP_IMP');
  const ebopsDim = structure.dimensions.series.find((entry) => entry.id === 'EBOPS');
  const countryDim = structure.dimensions.series.find((entry) => entry.id === 'COUNTRY');
  const freqDim = structure.dimensions.series.find((entry) => entry.id === 'FREQ');
  if (!directionDim || !ebopsDim || !countryDim || !freqDim) {
    throw new Error('ABS services response is missing a required dimension');
  }
  const directionIndex = dimensionIndex(structure, 'EXP_IMP');
  const ebopsIndex = dimensionIndex(structure, 'EBOPS');
  const countryIndex = dimensionIndex(structure, 'COUNTRY');
  const freqIndex = dimensionIndex(structure, 'FREQ');

  const multiplier = unitMultiplier(json);
  const times = timeValues(json);
  const records: AbsTradeRecordInput[] = [];

  for (const [seriesKey, series] of Object.entries(json.data.dataSets[0]!.series)) {
    const direction = valueAt(structure, directionDim, seriesKey, directionIndex);
    const ebops = valueAt(structure, ebopsDim, seriesKey, ebopsIndex);
    const country = valueAt(structure, countryDim, seriesKey, countryIndex).id;
    const freq = valueAt(structure, freqDim, seriesKey, freqIndex).id;
    if (country !== 'TOT' || ebops.id !== 'TOTAL' || freq !== 'A') continue;
    if (direction.id !== 'EXP' && direction.id !== 'IMP') {
      throw new Error(`unmapped services EXP_IMP ${direction.id}`);
    }
    const tradeFlow = direction.id === 'EXP' ? 'export' : 'import';
    const commodityName = ebops.name ?? 'Total Services (BPM basis)';

    for (const [obsIndex, observation] of Object.entries(series.observations)) {
      const value = observation[0];
      if (typeof value !== 'number') continue;
      const period = times[Number(obsIndex)];
      if (!period) throw new Error(`observation index ${obsIndex} has no TIME_PERIOD`);
      records.push({
        trade_flow: tradeFlow,
        measure_type: 'trade_value',
        commodity_name: commodityName,
        commodity_code: 'TOTAL',
        jurisdiction_level: 'federal',
        location: { granularity: 'national' },
        amount_cents: toCents(value, multiplier),
        financial_year: financialYearForLabelYear(period),
        time_period: period,
        source_dataset: ABS_TRADE_SOURCE_DATASET,
        source_url: options.sourceUrl,
        source_date: options.sourceDate,
        data_quality_flag: ABS_TRADE_DATA_QUALITY_FLAG,
      });
    }
  }
  return records;
}

/** Build the exact Data API query URL. */
export function absDataUrl(path: string): string {
  return `https://data.api.abs.gov.au/rest/${path}`;
}
