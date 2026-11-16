import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DUBBO_REGION } from '@ausspend/shared';
import { createApp } from '../src/app';
import { DataSourceModel, MeasureModel, RegionModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_area`;

const app = createApp({ pingDb: async () => 'connected' });

let nswId = '';
let dubboId = '';
const regionIds: string[] = [];

const BASE = {
  fiscal_year: '2026-27',
  verified: false,
  source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
};

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();

  await DataSourceModel.create({
    source_id: 'dubbo-council',
    name: 'Dubbo Regional Council — Annual Report / Operational Plan',
    publisher: 'Dubbo Regional Council',
    source_url: 'https://www.dubbo.nsw.gov.au/',
    retrieved_at: '2026-11-17T00:00:00.000Z',
    license: 'Test',
    verified: false,
    status: 'active',
    records_ingested: 0,
    errors: [],
    deferred_resources: [],
  });

  const regions = await RegionModel.insertMany([
    { code: 'AUS', name: 'Australia', level: 'national' },
    { code: 'NSW', name: 'New South Wales', level: 'state' },
    { ...DUBBO_REGION, _id: new mongoose.Types.ObjectId(DUBBO_REGION._id) },
  ]);
  for (const region of regions) regionIds.push(region._id.toString());
  nswId = regions[1]!._id.toString();
  dubboId = regions[2]!._id.toString();

  await MeasureModel.insertMany([
    {
      ...BASE,
      region_id: new mongoose.Types.ObjectId(dubboId),
      amount_cents: 1_000_000,
      measure_type: 'budget',
      source_id: 'dubbo-council',
      jurisdiction_level: 'local',
      jurisdiction: 'NSW',
      delivery_entity: 'Dubbo Regional Council',
      data_quality_flag: 'provisional',
      extraction_confidence: 'high',
      location: { state: 'NSW', lga_name: 'Dubbo' },
    },
    {
      ...BASE,
      region_id: new mongoose.Types.ObjectId(dubboId),
      amount_cents: 250_000,
      measure_type: 'budget',
      source_id: 'dubbo-council',
      jurisdiction_level: 'local',
      jurisdiction: 'NSW',
      location: { state: 'NSW', lga_name: 'Dubbo' },
    },
    {
      ...BASE,
      region_id: new mongoose.Types.ObjectId(nswId),
      amount_cents: 2_000_000,
      measure_type: 'budget',
      source_id: 'nsw-budget',
      jurisdiction_level: 'state',
      jurisdiction: 'NSW',
    },
    {
      ...BASE,
      amount_cents: 3_000_000,
      measure_type: 'contract',
      source_id: 'aus-tender',
      source_url: 'https://www.tenders.gov.au/',
      jurisdiction_level: 'federal',
      jurisdiction: 'Commonwealth',
      location: { state: 'NSW' },
    },
    {
      ...BASE,
      amount_cents: 4_000_000,
      measure_type: 'contract',
      source_id: 'aus-tender',
      source_url: 'https://www.tenders.gov.au/',
      jurisdiction_level: 'federal',
      jurisdiction: 'Commonwealth',
      location: { state: 'VIC' },
    },
    {
      ...BASE,
      amount_cents: 5_000_000,
      measure_type: 'budget',
      source_id: 'data-gov-au-pbs',
      source_url: 'https://data.gov.au/',
      jurisdiction_level: 'federal',
      jurisdiction: 'Commonwealth',
      location: { state: 'Commonwealth' },
    },
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('area contract C', () => {
  it('returns four panels and no cross-level total for region=Dubbo', async () => {
    const response = await request(app).get('/api/spending?region=Dubbo&page_size=50');

    expect(response.status).toBe(200);
    expect(response.body.area_profile).toBeTruthy();
    const keys = response.body.area_profile.panels.map((panel: { key: string }) => panel.key);
    expect(keys).toEqual(['local', 'state_nsw', 'federal_nsw_tagged', 'commonwealth_pbs']);
    for (const panel of response.body.area_profile.panels) {
      expect(panel.total_cents).toBeNull();
      expect(panel).not.toHaveProperty('total');
    }
    expect(response.body.summary.total_cents).toBeNull();
    expect(response.body.summary.total_by_measure_type).toEqual([]);
    expect(response.body.applied_filters.area).toBe('dubbo');

    const ids = response.body.data.map((row: { source_id: string; jurisdiction_level: string }) => [
      row.source_id,
      row.jurisdiction_level,
    ]);
    // local + NSW state + NSW-tagged federal are present; VIC and PBS are not.
    expect(ids).toContainEqual(['dubbo-council', 'local']);
    expect(ids).toContainEqual(['nsw-budget', 'state']);
    expect(ids).toContainEqual(['aus-tender', 'federal']);
    expect(
      response.body.data.some(
        (row: { location?: { state?: string } }) => row.location?.state === 'VIC',
      ),
    ).toBe(false);
    expect(ids.some(([source]: [string]) => source === 'data-gov-au-pbs')).toBe(false);
    expect(response.body.data.every((row: { source_url: string }) => Boolean(row.source_url))).toBe(
      true,
    );
  });

  it('accepts area=dubbo as an explicit alias with the same profile', async () => {
    const byRegion = await request(app).get('/api/spending?region=dubbo');
    const byArea = await request(app).get('/api/spending?area=dubbo');
    expect(byArea.status).toBe(200);
    expect(byArea.body.area_profile).toEqual(byRegion.body.area_profile);
    expect(byArea.body.area_profile.caution).toMatch(/NOT additive/);
    expect(byArea.body.area_profile.not_covered.councils.length).toBeGreaterThan(0);
    expect(byArea.body.area_profile.not_covered.states).toContain('VIC — not covered (stub)');
  });

  it('keeps a 24-character region _id as an exact single-region filter', async () => {
    const response = await request(app).get(`/api/spending?region=${dubboId}&page_size=50`);
    expect(response.status).toBe(200);
    expect(response.body.area_profile).toBeUndefined();
    expect(response.body.pagination.total).toBe(2);
    expect(
      response.body.data.every((row: { region_id: string }) => row.region_id === dubboId),
    ).toBe(true);
  });

  it('serves /regions/dubbo, /region/dubbo and /areas/dubbo from one profile', async () => {
    const [regions, alias, areas] = await Promise.all([
      request(app).get('/api/regions/dubbo'),
      request(app).get('/api/region/dubbo'),
      request(app).get('/api/areas/dubbo'),
    ]);
    for (const response of [regions, alias, areas]) {
      expect(response.status).toBe(200);
      expect(response.body.region).toMatchObject({ code: 'NSW-DUBBO', level: 'region' });
      expect(response.body.area_profile.panels).toHaveLength(4);
      expect(response.body.total_cents).toBeNull();
    }
    expect(alias.body.area_profile).toEqual(regions.body.area_profile);
    expect(areas.body.area_profile).toEqual(regions.body.area_profile);
  });

  it('shows the PBS panel as Commonwealth-wide, not a Dubbo row', async () => {
    const response = await request(app).get('/api/spending?area=dubbo');
    const pbs = response.body.area_profile.panels.find(
      (panel: { key: string }) => panel.key === 'commonwealth_pbs',
    );
    expect(pbs.count).toBe(1);
    expect(pbs.label).toMatch(/Commonwealth-wide/);
    expect(pbs.jurisdiction_level).toBe('federal');
  });

  it('still resolves state slugs but keeps state detail non-area', async () => {
    const response = await request(app).get(`/api/regions/${nswId}`);
    expect(response.status).toBe(200);
    expect(response.body.region.code).toBe('NSW');
    expect(response.body.area_profile).toBeUndefined();
  });
});
