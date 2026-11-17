import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SpendingMeasureRowSchema } from '@ausspend/shared';
import { createApp } from '../src/app';
import { MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_nswp3`;

const app = createApp({ pingDb: async () => 'connected' });

let projectId = '';
let statementId = '';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();

  const [project, statement] = await MeasureModel.insertMany([
    {
      amount_cents: 118_100_000,
      measure_type: 'budget',
      fiscal_year: '2025-26',
      source_id: 'nsw-budget',
      source_url:
        'https://services2.arcgis.com/Yb2UeNWvQYEwyYDl/arcgis/rest/services/Treasury_Project_Data_20260609_gdb/FeatureServer/0',
      verified: false,
      notes: 'ArcGIS feature layer Treasury_Project_Data_20260609_gdb',
      natural_key: 'nsw-budget:api-project',
      project_name: 'Chichester Trunk Gravity Main',
      description: 'Major Works — Works in Progress',
      jurisdiction_level: 'state',
      jurisdiction: 'NSW',
      source_dataset: 'NSW Budget 2025-26 Open Data',
      source_date: '2026-06-22',
      data_quality_flag: 'provisional',
      project_id: '104155',
      agency: 'Hunter Water Corporation',
      sector: 'Public Non-Financial Corporations',
      cluster: 'NA/Water',
      electorate: 'UPPER HUNTER',
      region: 'Hunter',
      lga: 'DUNGOG',
      status: 'Works in Progress',
      category: 'Major Works',
      budget_year: '2025-26',
      location: { state: 'NSW', lga_name: 'DUNGOG' },
    },
    {
      amount_cents: 50_307_429_100_001,
      measure_type: 'budget',
      fiscal_year: '2025-26',
      source_id: 'nsw-budget',
      source_url: 'https://www.budget.nsw.gov.au/budget-detail/open-data',
      verified: false,
      notes: 'Workbook: 2025-26-Budget-Financial-Statements.xlsx',
      natural_key: 'nsw-budget:api-statement',
      project_name: 'Employee',
      description: 'GG Operating Statement — Employee',
      jurisdiction_level: 'state',
      jurisdiction: 'NSW',
      data_quality_flag: 'provisional',
      location: { state: 'NSW' },
    },
  ]);
  projectId = project!._id.toString();
  statementId = statement!._id.toString();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('NSW project fields in the spending API', () => {
  it('returns the promoted ArcGIS dimensions for a project row', async () => {
    const response = await request(app).get('/api/spending?q=Chichester&page_size=5');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    const row = response.body.data[0];
    expect(row).toMatchObject({
      source_id: 'nsw-budget',
      amount_cents: 118_100_000,
      measure_type: 'budget',
      fiscal_year: '2025-26',
      project_id: '104155',
      agency: 'Hunter Water Corporation',
      sector: 'Public Non-Financial Corporations',
      cluster: 'NA/Water',
      electorate: 'UPPER HUNTER',
      region: 'Hunter',
      lga: 'DUNGOG',
      status: 'Works in Progress',
      category: 'Major Works',
      budget_year: '2025-26',
      location: { state: 'NSW', lga_name: 'DUNGOG' },
    });
    expect(SpendingMeasureRowSchema.safeParse(row).success).toBe(true);
  });

  it('returns the same shape for one project by id', async () => {
    const response = await request(app).get(`/api/spending/${projectId}`);
    expect(response.status).toBe(200);
    expect(response.body.project_id).toBe('104155');
    expect(response.body.amount_cents).toBe(118_100_000);
    expect(SpendingMeasureRowSchema.safeParse(response.body).success).toBe(true);
  });

  it('does not invent project fields on a statement row', async () => {
    const response = await request(app).get(`/api/spending/${statementId}`);
    expect(response.status).toBe(200);
    for (const field of [
      'project_id',
      'agency',
      'sector',
      'cluster',
      'electorate',
      'region',
      'lga',
      'status',
      'category',
      'budget_year',
    ]) {
      expect(response.body[field]).toBeUndefined();
    }
    expect(SpendingMeasureRowSchema.safeParse(response.body).success).toBe(true);
  });
});
