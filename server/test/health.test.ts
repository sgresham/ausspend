import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('GET /api/health', () => {
  it('returns ok with a connected database', async () => {
    const app = createApp({ pingDb: async () => 'connected' });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, db: 'connected' });
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  it('returns ok with an unavailable database', async () => {
    const app = createApp({ pingDb: async () => 'unavailable' });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, db: 'unavailable' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const app = createApp({ pingDb: async () => 'connected' });

    const response = await request(app).get('/api/nope');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ ok: false, error: 'Not found', path: '/api/nope' });
  });
});
