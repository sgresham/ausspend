import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  TradeRecordModel,
  type TradeLocationDocument,
  type TradeRecordDocument,
} from '../models/index.js';
import { badRequest } from './errors.js';

/** Filters accepted by every trade endpoint. */
const TradeQuerySchema = z.object({
  trade_flow: z.enum(['import', 'export']).optional(),
  measure_type: z
    .enum(['trade_value', 'cif_fob_margin', 'port_interface_cost', 'trade_volume', 'trade_price'])
    .optional(),
  commodity: z.string().trim().min(1).max(200).optional(),
  partner_country: z.string().trim().min(1).max(200).optional(),
  port: z.string().trim().min(1).max(200).optional(),
  financial_year: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'financial_year must look like YYYY-YY')
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export type TradeFilters = z.infer<typeof TradeQuerySchema>;

export const TRADE_NON_ADDITIVE_WARNING =
  'Trade values, CIF/FOB margins, port interface costs, trade volumes and trade prices are different measures and must never be summed. CIF/FOB is a border cost, not profit. Port costs are not national totals.';

type LeanTradeRecord = TradeRecordDocument & { _id: mongoose.Types.ObjectId };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseTradeFilters(query: unknown): TradeFilters {
  const parsed = TradeQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid trade query parameters');
  }
  return parsed.data;
}

function tradeQuery(filters: TradeFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.trade_flow) query.trade_flow = filters.trade_flow;
  if (filters.measure_type) query.measure_type = filters.measure_type;
  if (filters.financial_year) query.financial_year = filters.financial_year;
  if (filters.commodity) {
    // Commodity labels are long; a case-insensitive contains match is the
    // useful filter. Everything else is an exact, case-insensitive match.
    query.commodity_name = { $regex: escapeRegex(filters.commodity), $options: 'i' };
  }
  if (filters.partner_country) {
    query.partner_country = {
      $regex: `^${escapeRegex(filters.partner_country)}$`,
      $options: 'i',
    };
  }
  if (filters.port) {
    const portMatch = { $regex: `^${escapeRegex(filters.port)}$`, $options: 'i' };
    query.$or = [{ port_name: portMatch }, { 'location.port': portMatch }];
  }
  return query;
}

function serializeLocation(location: TradeLocationDocument | undefined) {
  if (!location) return null;
  return {
    state: location.state ?? null,
    port: location.port ?? null,
    granularity: location.granularity,
  };
}

function serializeTradeRow(row: LeanTradeRecord) {
  return {
    id: row._id.toString(),
    trade_flow: row.trade_flow,
    measure_type: row.measure_type,
    commodity_name: row.commodity_name,
    commodity_code: row.commodity_code ?? null,
    partner_country: row.partner_country ?? null,
    port_name: row.port_name ?? null,
    jurisdiction_level: row.jurisdiction_level,
    location: serializeLocation(row.location),
    amount_cents: row.amount_cents,
    margin_percent: row.margin_percent ?? null,
    index_value: row.index_value ?? null,
    volume: row.volume ?? null,
    price: row.price ?? null,
    financial_year: row.financial_year,
    time_period: row.time_period ?? null,
    source_dataset: row.source_dataset,
    source_url: row.source_url,
    source_date: row.source_date,
    data_quality_flag: row.data_quality_flag,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

interface MeasureTypeSummaryRow {
  _id: TradeRecordDocument['measure_type'];
  count: number;
  amount_cents: number;
}

interface MeasureTypeFlowSummaryRow {
  _id: {
    measure_type: TradeRecordDocument['measure_type'];
    trade_flow: TradeRecordDocument['trade_flow'];
  };
  count: number;
  amount_cents: number;
}

function summaryByMeasureType(rows: MeasureTypeSummaryRow[]) {
  return rows.map((row) => ({
    measure_type: row._id,
    count: row.count,
    amount_cents: row.amount_cents,
  }));
}

/**
 * GET /api/trade — filtered trade observations plus a per-measure summary.
 *
 * No total is computed: trade values, CIF/FOB margins, port interface costs,
 * trade volumes and trade prices are different measures. Even within one
 * measure type the URL never emits a cross-measure grand total.
 */
export const listTrade: RequestHandler = async (req, res) => {
  const filters = parseTradeFilters(req.query);
  const query = tradeQuery(filters);
  const limit = filters.limit ?? 200;
  const offset = filters.offset ?? 0;
  const [total, rows, summaryRows] = await Promise.all([
    TradeRecordModel.countDocuments(query),
    TradeRecordModel.find(query)
      .sort({ financial_year: -1, trade_flow: 1, measure_type: 1, commodity_name: 1, _id: 1 })
      .skip(offset)
      .limit(limit)
      .lean<LeanTradeRecord[]>(),
    TradeRecordModel.aggregate<MeasureTypeSummaryRow>([
      { $match: query },
      {
        $group: {
          _id: '$measure_type',
          count: { $sum: 1 },
          amount_cents: { $sum: '$amount_cents' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const summary = summaryByMeasureType(summaryRows);
  res.set('Cache-Control', 'no-store');
  res.json({
    filters,
    rows: rows.map(serializeTradeRow),
    summary,
    counts: {
      rows: rows.length,
      total,
      by_measure_type: Object.fromEntries(
        summary.map((entry) => [entry.measure_type, entry.count]),
      ),
    },
    pagination: { limit, offset, total },
    warning: TRADE_NON_ADDITIVE_WARNING,
    note: 'Trade records are a separate analytical domain. They are never joined to, or summed with, spending records.',
  });
};

/**
 * GET /api/trade/summary — grouped by measure type and flow.
 *
 * The response is intentionally a set of separate groups, never one combined
 * total. `additive: false` makes the contract explicit.
 */
export const getTradeSummary: RequestHandler = async (req, res) => {
  const filters = parseTradeFilters(req.query);
  const query = tradeQuery(filters);
  const groups = await TradeRecordModel.aggregate<MeasureTypeFlowSummaryRow>([
    { $match: query },
    {
      $group: {
        _id: { measure_type: '$measure_type', trade_flow: '$trade_flow' },
        count: { $sum: 1 },
        amount_cents: { $sum: '$amount_cents' },
      },
    },
    { $sort: { '_id.measure_type': 1, '_id.trade_flow': 1 } },
  ]);

  const summary = groups.map((group) => ({
    measure_type: group._id.measure_type,
    trade_flow: group._id.trade_flow,
    count: group.count,
    amount_cents: group.amount_cents,
  }));

  res.set('Cache-Control', 'no-store');
  res.json({
    filters,
    summary,
    counts: {
      groups: summary.length,
      rows: summary.reduce((sum, entry) => sum + entry.count, 0),
    },
    additive: false,
    warning: TRADE_NON_ADDITIVE_WARNING,
    note: 'Each group is a different measure. Never add values, CIF/FOB margins, port costs, volumes or prices together, and never present a port cost as a national total.',
  });
};

/** GET /api/trade/years — distinct financial years available for the filters. */
export const listTradeYears: RequestHandler = async (req, res) => {
  const filters = parseTradeFilters(req.query);
  const query = tradeQuery(filters);
  const years = (await TradeRecordModel.distinct('financial_year', query)).sort().reverse();
  res.set('Cache-Control', 'no-store');
  res.json({
    filters,
    years,
    count: years.length,
    warning: TRADE_NON_ADDITIVE_WARNING,
  });
};

/** GET /api/trade/commodities — distinct commodity names/codes with row counts. */
export const listTradeCommodities: RequestHandler = async (req, res) => {
  const filters = parseTradeFilters(req.query);
  const query = tradeQuery(filters);
  const rows = await TradeRecordModel.aggregate<{
    _id: { commodity_name: string; commodity_code?: string };
    count: number;
  }>([
    { $match: query },
    {
      $group: {
        _id: { commodity_name: '$commodity_name', commodity_code: '$commodity_code' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.commodity_name': 1, '_id.commodity_code': 1 } },
  ]);

  const commodities = rows.map((row) => ({
    commodity_name: row._id.commodity_name,
    commodity_code: row._id.commodity_code ?? null,
    count: row.count,
  }));

  res.set('Cache-Control', 'no-store');
  res.json({
    filters,
    commodities,
    count: commodities.length,
    warning: TRADE_NON_ADDITIVE_WARNING,
  });
};

/** GET /api/trade/partners — distinct partner countries with row counts. */
export const listTradePartners: RequestHandler = async (req, res) => {
  const filters = parseTradeFilters(req.query);
  const query = tradeQuery(filters);
  const partnerMatch =
    query.partner_country !== undefined
      ? query
      : { ...query, partner_country: { $exists: true, $nin: ['', null] } };
  const rows = await TradeRecordModel.aggregate<{ _id: string; count: number }>([
    { $match: partnerMatch },
    { $group: { _id: '$partner_country', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const partners = rows.map((row) => ({ partner_country: row._id, count: row.count }));

  res.set('Cache-Control', 'no-store');
  res.json({
    filters,
    partners,
    count: partners.length,
    warning: TRADE_NON_ADDITIVE_WARNING,
  });
};
