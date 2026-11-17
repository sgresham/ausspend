import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { MeasureModel, RegionModel } from '../src/models/index.js';

/**
 * Regression test for the state/region page truncation bug: the summary must be
 * computed over ALL matching rows, not over the 2,000-row page. A mixed
 * grant_award + contract QLD view must report the full count and withhold the
 * headline total instead of returning a partial single-type total.
 */
const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_stateagg`;

const app = createApp({ pingDb: async () => 'connected' });

const GRANT_ROWS = 2_001;
const CONTRACT_ROWS = 2;
const AUS_TENDER_ROWS = 5;
const GRANT_CENTS = 100;
const CONTRACT_CENTS = 250;
const ALL_ROWS = GRANT_ROWS + CONTRACT_ROWS + AUS_TENDER_ROWS;

let qldId = '';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();

  const regions = await RegionModel.insertMany([
    { code: 'QLD', name: 'Queensland', level: 'state' },
  ]);
  qldId = regions[0]!._id.toString();

  const grantRows = Array.from({ length: GRANT_ROWS }, (_, index) => ({
    region_id: regions[0]!._id,
    function_code: null,
    amount_cents: GRANT_CENTS,
    measure_type: 'grant_award',
    fiscal_year: '2024-25',
    source_id: 'qld-qgip',
    source_url: 'https://example.test/qld-qgip.csv',
    verified: false,
    natural_key: `test-grant-${index}`,
    jurisdiction_level: 'state',
    jurisdiction: 'QLD',
    aggregation_role: 'additive',
    location: { state: 'QLD' },
  }));
  const contractRows = Array.from({ length: CONTRACT_ROWS }, (_, index) => ({
    region_id: regions[0]!._id,
    function_code: null,
    amount_cents: CONTRACT_CENTS,
    measure_type: 'contract',
    fiscal_year: '2024-25',
    source_id: 'qld-qgip',
    source_url: 'https://example.test/qld-qgip.csv',
    verified: false,
    natural_key: `test-contract-${index}`,
    jurisdiction_level: 'state',
    jurisdiction: 'QLD',
    aggregation_role: 'additive',
    location: { state: 'QLD' },
  }));
  // A federal contract merely *located* in QLD. The state page is the QLD
  // government's own spending, so this must NOT be counted in the QLD page
  // (jurisdiction is Commonwealth, not QLD).
  const ausTenderRows = Array.from({ length: AUS_TENDER_ROWS }, (_, index) => ({
    region_id: null,
    function_code: null,
    amount_cents: 1_000,
    measure_type: 'contract',
    fiscal_year: '2024-25',
    source_id: 'aus-tender',
    source_url: 'https://example.test/aus-tender.json',
    verified: false,
    natural_key: `test-aus-tender-${index}`,
    jurisdiction_level: 'federal',
    jurisdiction: 'Commonwealth',
    aggregation_role: 'additive',
    location: { state: 'QLD' },
  }));
  await MeasureModel.insertMany([...grantRows, ...contractRows, ...ausTenderRows]);
}, 30_000);

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('state page aggregates over the whole match set', () => {
  it('reports a full count that matches the DB QLD jurisdiction set', async () => {
    const response = await request(app).get('/api/states/QLD?fiscal_year=2024-25');
    expect(response.status).toBe(200);
    // The API must equal the state's jurisdiction dataset, not include the
    // location-tagged federal rows.
    const dbCount = await MeasureModel.countDocuments({
      jurisdiction: 'QLD',
      fiscal_year: '2024-25',
    });
    expect(dbCount).toBe(GRANT_ROWS + CONTRACT_ROWS);
    expect(response.body.count).toBe(dbCount);
    expect(response.body.count).not.toBe(ALL_ROWS);
    expect(response.body.mixed).toBe(true);
    expect(response.body.total_cents).toBeNull();
    expect(response.body.total_measure_type).toBeNull();
    expect(response.body.rows_returned).toBe(2000);
    expect(response.body.rows_truncated).toBe(true);

    const byType = new Map(
      response.body.total_by_measure_type.map(
        (entry: { measure_type: string; count: number; total_cents: number }) => [
          entry.measure_type,
          entry,
        ],
      ),
    );
    expect(byType.get('grant_award')).toMatchObject({
      count: GRANT_ROWS,
      total_cents: GRANT_ROWS * GRANT_CENTS,
    });
    expect(byType.get('contract')).toMatchObject({
      count: CONTRACT_ROWS,
      total_cents: CONTRACT_ROWS * CONTRACT_CENTS,
    });
    // DB per-type totals agree with the API per-type totals.
    const [dbGrant, dbContract] = await Promise.all([
      MeasureModel.countDocuments({
        jurisdiction: 'QLD',
        fiscal_year: '2024-25',
        measure_type: 'grant_award',
      }),
      MeasureModel.countDocuments({
        jurisdiction: 'QLD',
        fiscal_year: '2024-25',
        measure_type: 'contract',
      }),
    ]);
    expect(byType.get('grant_award')?.count).toBe(dbGrant);
    expect(byType.get('contract')?.count).toBe(dbContract);
  });

  it('isolates one source with source_id', async () => {
    const response = await request(app).get(
      '/api/states/QLD?fiscal_year=2024-25&source_id=qld-qgip',
    );
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(GRANT_ROWS + CONTRACT_ROWS);
    expect(response.body.mixed).toBe(true);
    expect(response.body.total_cents).toBeNull();
    const byType = new Map(
      response.body.total_by_measure_type.map(
        (entry: { measure_type: string; count: number; total_cents: number }) => [
          entry.measure_type,
          entry,
        ],
      ),
    );
    expect(byType.get('grant_award')).toMatchObject({ count: GRANT_ROWS });
    expect(byType.get('contract')).toMatchObject({ count: CONTRACT_ROWS });
  });

  it('returns the full single-type total even though rows are paged to 2,000', async () => {
    const response = await request(app).get(
      '/api/states/QLD?fiscal_year=2024-25&measure_type=grant_award',
    );
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(GRANT_ROWS);
    expect(response.body.mixed).toBe(false);
    expect(response.body.total_cents).toBe(GRANT_ROWS * GRANT_CENTS);
    expect(response.body.total_measure_type).toBe('grant_award');
    expect(response.body.rows_returned).toBe(2000);
    expect(response.body.rows_truncated).toBe(true);
    expect(response.body.total_by_measure_type).toEqual([
      {
        measure_type: 'grant_award',
        count: GRANT_ROWS,
        total_cents: GRANT_ROWS * GRANT_CENTS,
      },
    ]);
  });

  it('applies the same whole-set aggregate to /api/regions/<id>', async () => {
    // /api/regions/<id> matches region_id only (the aus-tender rows have no
    // region_id), so the QLD state region sees just the QGIP rows.
    const response = await request(app).get(`/api/regions/${qldId}?fiscal_year=2024-25`);
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(GRANT_ROWS + CONTRACT_ROWS);
    expect(response.body.mixed).toBe(true);
    expect(response.body.total_cents).toBeNull();
    expect(response.body.rows_truncated).toBe(true);
  });
});
