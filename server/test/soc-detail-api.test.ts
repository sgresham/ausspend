import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_socdetail`;

const app = createApp({ pingDb: async () => 'connected' });
const URL_2025 =
  'https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
  const base = {
    source_id: 'waternsw',
    source_url: URL_2025,
    source_dataset: 'WaterNSW Annual Report 2024-25',
    fiscal_year: '2024-25',
    measure_type: 'actual' as const,
    jurisdiction_level: 'soc' as const,
    jurisdiction: 'NSW',
    delivery_entity: 'WaterNSW',
    funding_source: 'WaterNSW',
    soc_unit: 'AUD_thousands',
    verified: false,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail' as const,
    extraction_confidence: 'high' as const,
  };
  await MeasureModel.insertMany([
    {
      ...base,
      natural_key: 'waternsw:api-total-revenue',
      soc_line_item: 'total_revenue',
      soc_line_label: 'Total revenue',
      soc_section: 'revenue',
      soc_note: 'Face statement',
      amount_cents: 49_500_400_000,
      potential_double_count: false,
    },
    {
      ...base,
      natural_key: 'waternsw:api-note2-greater-sydney',
      soc_line_item: 'water_supply_regulated_greater_sydney',
      soc_line_label: 'Regulated - Greater Sydney',
      soc_section: 'revenue',
      soc_note: 'Note 2 Revenue from water supply and delivery',
      soc_component_of: 'revenue_from_water_supply_and_delivery',
      soc_breakdown: 'water_supply_segment',
      soc_printed_sign: 'positive',
      amount_cents: 22_454_000_000,
      potential_double_count: false,
    },
    {
      ...base,
      natural_key: 'waternsw:api-employee-expenses',
      soc_line_item: 'employee_expenses',
      soc_line_label: 'Employee related expenses',
      soc_section: 'expenses',
      soc_note: 'Face statement',
      amount_cents: 16_365_400_000,
      potential_double_count: false,
    },
    {
      ...base,
      natural_key: 'waternsw:api-note5-capitalisation',
      soc_line_item: 'employee_expenses_capitalisation',
      soc_line_label: 'Capitalisation of employee related expenses',
      soc_section: 'expenses',
      soc_note: 'Note 5 Employee related expenses',
      soc_component_of: 'employee_expenses',
      soc_breakdown: 'employee_expense_component',
      soc_printed_sign: 'negative',
      amount_cents: 4_383_800_000,
      potential_double_count: false,
    },
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('GET /api/soc WaterNSW note detail', () => {
  it('returns note/section provenance and counts, and never computes a total', async () => {
    const response = await request(app).get('/api/soc').query({ entity: 'WaterNSW' });
    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown> & {
      series: Array<Record<string, unknown>>;
      counts: Record<string, unknown>;
    };
    expect(body.series).toHaveLength(4);
    expect(body.counts.series).toBe(4);
    expect(body.counts.by_section).toEqual({ revenue: 2, expenses: 2 });
    expect(body.counts.by_note).toEqual({
      'Face statement': 2,
      'Note 2 Revenue from water supply and delivery': 1,
      'Note 5 Employee related expenses': 1,
    });
    const noteRow = body.series.find(
      (row) => row.soc_line_item === 'water_supply_regulated_greater_sydney',
    );
    expect(noteRow).toMatchObject({
      soc_section: 'revenue',
      soc_note: 'Note 2 Revenue from water supply and delivery',
      soc_component_of: 'revenue_from_water_supply_and_delivery',
      soc_breakdown: 'water_supply_segment',
      soc_printed_sign: 'positive',
    });
    const deduction = body.series.find(
      (row) => row.soc_line_item === 'employee_expenses_capitalisation',
    );
    expect(deduction).toMatchObject({
      soc_component_of: 'employee_expenses',
      soc_printed_sign: 'negative',
      amount_cents: 4_383_800_000,
    });
    // No aggregate field anywhere: the endpoint exposes published rows and counts only.
    const serialised = JSON.stringify(body);
    expect(serialised).not.toMatch(/total_cents|total_amount|combined_total/);
    expect(String(body.note)).toMatch(/No total is computed/i);
    expect(String(body.note)).toMatch(/never additional spending/i);
  });
});
