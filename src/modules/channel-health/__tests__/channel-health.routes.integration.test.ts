// End-to-end integration test for T24-followup route landing.
// Boots the real Fastify server via `buildServer()` and drives it via
// `fastify.inject`: JWT verify → real Prisma → response composition.
// Skipped without DATABASE_URL per T17/T19/T20/T23-followup precedent.

import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { resetConfigCache } from '@core/config/env.js';

import { HealthResponseSchema } from '../channel-health.schema.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const JWT_SECRET = 'x'.repeat(48);

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('T24-followup route landing (integration)', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let app: FastifyInstance;
  let db: PrismaClient;

  beforeAll(async () => {
    savedEnv = { ...process.env };
    process.env['NODE_ENV'] = 'development';
    process.env['LOG_LEVEL'] = 'silent';
    process.env['API_BASE_URL'] ??= 'http://localhost:3000';
    process.env['CORS_ORIGIN'] ??= 'http://localhost:5173';
    process.env['REDIS_URL'] ??= 'redis://localhost:6380';
    process.env['JWT_ACCESS_SECRET'] = JWT_SECRET;
    process.env['JWT_REFRESH_SECRET'] = 'y'.repeat(48);
    process.env['ENCRYPTION_KEY'] = 'a'.repeat(64);
    process.env['ENCRYPTION_KEY_VERSION'] = 'v1';
    resetConfigCache();

    const prismaModule = await import('@core/prisma/prisma-client.js');
    db = prismaModule.db;

    const apiModule = await import('../../../entrypoints/api-server.js');
    app = await apiModule.buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (db) await db.$disconnect();
    process.env = savedEnv;
    resetConfigCache();
  });

  beforeEach(async () => {
    await db.channelHealthSnapshot.deleteMany({});
  });

  function base64Url(input: Buffer | string): string {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
    return buf.toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  function signGmAdminJwt(overrides: Record<string, unknown> = {}): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: 'user-1',
      hotel_id: HOTEL_ID,
      role: 'gm_admin',
      exp: now + 3600,
      iat: now,
      ...overrides,
    };
    const h = base64Url(JSON.stringify(header));
    const p = base64Url(JSON.stringify(payload));
    const sig = base64Url(createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest());
    return `${h}.${p}.${sig}`;
  }

  it('should return 401 canonical envelope on GET without Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/integrations/health' });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('AUTH_ERROR');
  });

  it('should return 403 canonical envelope when the JWT role is not gm_admin', async () => {
    const token = signGmAdminJwt({ role: 'staff' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/health',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('FORBIDDEN');
  });

  it('should return 200 with all subsystems defaulted (healthy for un-probed WA/TG; healthy + synthetic clock for un-probed Claude)', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/health',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const parsed = HealthResponseSchema.parse(res.json());
    expect(parsed.whatsapp.status).toBe('healthy');
    expect(parsed.telegram.status).toBe('healthy');
    expect(parsed.claude_api.status).toBe('healthy');
    expect(typeof parsed.claude_api.last_check_at).toBe('string');
  });

  it('should return 200 reflecting the latest seeded snapshot per provider', async () => {
    await db.channelHealthSnapshot.createMany({
      data: [
        { hotelId: HOTEL_ID, provider: 'whatsapp', status: 'healthy', latencyMs: 120 },
        { hotelId: HOTEL_ID, provider: 'telegram', status: 'degraded', latencyMs: 350 },
        { hotelId: HOTEL_ID, provider: 'claude_api', status: 'down', latencyMs: null },
      ],
    });

    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/health',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const parsed = HealthResponseSchema.parse(res.json());
    expect(parsed.whatsapp.status).toBe('healthy');
    expect(parsed.telegram.status).toBe('degraded');
    expect(parsed.claude_api.status).toBe('down');
    expect(typeof parsed.claude_api.last_check_at).toBe('string');
    expect(new Date(parsed.claude_api.last_check_at).toString()).not.toBe('Invalid Date');
  });

  it('should reflect only the most recent snapshot when multiple exist for a provider', async () => {
    const early = new Date(Date.now() - 60_000);
    const late = new Date();
    await db.channelHealthSnapshot.create({
      data: {
        hotelId: HOTEL_ID,
        provider: 'whatsapp',
        status: 'down',
        latencyMs: null,
        checkedAt: early,
      },
    });
    await db.channelHealthSnapshot.create({
      data: {
        hotelId: HOTEL_ID,
        provider: 'whatsapp',
        status: 'healthy',
        latencyMs: 100,
        checkedAt: late,
      },
    });

    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/health',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const parsed = HealthResponseSchema.parse(res.json());
    expect(parsed.whatsapp.status).toBe('healthy');
  });

  it('should echo the inbound x-correlation-id on the response', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/health',
      headers: { authorization: `Bearer ${token}`, 'x-correlation-id': 't24-followup-smoke' },
    });
    expect(res.headers['x-correlation-id']).toBe('t24-followup-smoke');
  });
});
