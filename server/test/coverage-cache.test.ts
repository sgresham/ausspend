import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { COVERAGE_CACHE_CONTROL, invalidateCoverageCache } from '../src/api/coverage';
import { IngestionLogModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_coverage`;

const app = createApp({ pingDb: async () => 'connected' });

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
});

beforeEach(async () => {
  invalidateCoverageCache();
  await IngestionLogModel.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('GET /api/meta/coverage cache', () => {
  it('serves a bounded cache with ETag and answers If-None-Match with 304', async () => {
    const first = await request(app).get('/api/meta/coverage');
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe(COVERAGE_CACHE_CONTROL);
    expect(first.headers['cache-control']).toContain('max-age=30');
    expect(first.headers.etag).toBeTruthy();

    const revalidated = await request(app)
      .get('/api/meta/coverage')
      .set('If-None-Match', first.headers.etag as string);
    expect(revalidated.status).toBe(304);
    expect(revalidated.text).toBe('');
  });

  it('recomputes and changes the ETag after a new ingestion log', async () => {
    const first = await request(app).get('/api/meta/coverage');
    const firstEtag = first.headers.etag as string;

    await IngestionLogModel.create({
      source_id: 'aus-tender',
      started_at: new Date('2026-01-01T00:00:00Z'),
      finished_at: new Date('2026-01-01T00:00:01Z'),
      status: 'success',
      records_fetched: 1,
      records_upserted: 1,
      errors: [],
    });

    const second = await request(app).get('/api/meta/coverage').set('If-None-Match', firstEtag);
    expect(second.status).toBe(200);
    expect(second.headers.etag).toBeTruthy();
    expect(second.headers.etag).not.toBe(firstEtag);
  });

  it('still returns 503 when the database is unavailable, even with a warm cache', async () => {
    const warm = await request(app).get('/api/meta/coverage');
    expect(warm.status).toBe(200);

    const unavailable = createApp({ pingDb: async () => 'unavailable' });
    const response = await request(unavailable).get('/api/meta/coverage');
    expect(response.status).toBe(503);
  });

  it('supports explicit invalidation', async () => {
    const first = await request(app).get('/api/meta/coverage');
    invalidateCoverageCache();
    const second = await request(app)
      .get('/api/meta/coverage')
      .set('If-None-Match', first.headers.etag as string);
    expect(second.status).toBe(200);
  });
});
