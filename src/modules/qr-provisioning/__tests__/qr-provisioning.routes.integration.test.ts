// End-to-end integration test for T22-followup route landing.
// Boots the real Fastify server via `buildServer()`. Requires a WA config
// row to be seeded so the QR regenerate path can source phoneNumber.
// Skipped without DATABASE_URL per T17/T19/T20/T23/T24-fu-A precedent.

import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { resetConfigCache } from '@core/config/env.js';

import { encrypt } from '@shared/utils/crypto.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const JWT_SECRET = 'x'.repeat(48);

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('T22-followup route landing (integration)', () => {
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
    await db.qrState.deleteMany({});
    await db.waConfig.deleteMany({});
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

  async function seedWaConfig(): Promise<void> {
    await db.waConfig.create({
      data: {
        hotelId: HOTEL_ID,
        bsp: '1engage',
        phoneNumberId: 'pnid-1',
        phoneNumber: '+62800001111',
        accessTokenEnc: encrypt('token'),
        webhookUrl: 'https://example.com/wa',
        webhookVerifyToken: 'z'.repeat(32),
      },
    });
  }

  it('should return 401 on POST /api/integrations/qr/regenerate without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/integrations/qr/regenerate' });
    expect(res.statusCode).toBe(401);
  });

  it('should return 404 when no WA config exists (phone lookup fails)', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'POST',
      url: '/api/integrations/qr/regenerate',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });

  it('should regenerate + persist qr_state on the happy path (stubbed renderer + storage)', async () => {
    await seedWaConfig();
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'POST',
      url: '/api/integrations/qr/regenerate',
      headers: { authorization: `Bearer ${token}` },
      payload: { greetingText: 'Halo' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ url: string; png_url: string; generated_at: string }>();
    expect(body.url.startsWith('https://wa.me/')).toBe(true);
    expect(body.png_url.startsWith('https://stub.qooma.local/qr/')).toBe(true);
    const rows = await db.qrState.findMany({ where: { hotelId: HOTEL_ID } });
    expect(rows).toHaveLength(1);
  });

  it('should stream a PNG on GET /api/integrations/qr/download after regenerate', async () => {
    await seedWaConfig();
    const token = signGmAdminJwt();
    await app.inject({
      method: 'POST',
      url: '/api/integrations/qr/regenerate',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    const download = await app.inject({
      method: 'GET',
      url: '/api/integrations/qr/download',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toContain('image/png');
    expect(download.rawPayload.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});
