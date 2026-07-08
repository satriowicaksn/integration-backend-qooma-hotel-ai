// End-to-end HTTP integration test for T17-followup route landing.
// Boots the real Fastify server via `buildServer()` (same wiring the
// production api.ts uses) and drives it with `fastify.inject`, so we
// exercise: JWT verify → tenant scope → zod body validation →
// TelegramConfigService → Prisma singleton → real Postgres → response
// envelope → correlation-id round-trip.

import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { resetConfigCache } from '@core/config/env.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const JWT_SECRET = 'x'.repeat(48);

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('T17 route landing (integration)', () => {
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
    await db.telegramConfig.deleteMany({});
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
    const res = await app.inject({ method: 'GET', url: '/api/integrations/telegram' });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('AUTH_ERROR');
  });

  it('should return 403 canonical envelope when the JWT role is not gm_admin', async () => {
    const token = signGmAdminJwt({ role: 'staff' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/telegram',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('should return 404 NOT_FOUND envelope on GET when no config exists yet', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/telegram',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string; details: { resource: string; id: string } } }>();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.details.resource).toBe('telegram_config');
    expect(body.error.details.id).toBe(HOTEL_ID);
  });

  it('should PUT then GET a config and mask the bot_token on the response', async () => {
    const token = signGmAdminJwt();
    const plaintext = '123456789:AAABBBcccDDDEeeFFFgggHHHiiiJJJkkk';

    const put = await app.inject({
      method: 'PUT',
      url: '/api/integrations/telegram',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        botToken: plaintext,
        botUsername: 'qooma_demo_bot',
        defaultChatId: '-100999',
      },
    });
    expect(put.statusCode).toBe(200);
    const putBody = put.json<{
      hotelId: string;
      botToken: string;
      botUsername: string;
      defaultChatId: string | null;
    }>();
    expect(putBody.hotelId).toBe(HOTEL_ID);
    expect(putBody.botToken).not.toContain(plaintext);
    expect(putBody.botToken.startsWith('***')).toBe(true);
    expect(putBody.botUsername).toBe('qooma_demo_bot');
    expect(putBody.defaultChatId).toBe('-100999');

    const get = await app.inject({
      method: 'GET',
      url: '/api/integrations/telegram',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);
    const getBody = get.json<{ botToken: string; hotelId: string }>();
    expect(getBody.hotelId).toBe(HOTEL_ID);
    expect(getBody.botToken).toBe(putBody.botToken);
    expect(getBody.botToken).not.toContain(plaintext);
  });

  it('should reject a PUT with an invalid body via zod validation', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/integrations/telegram',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        botToken: 'too-short',
        botUsername: 'has space',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should echo the inbound x-correlation-id on the response', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/telegram',
      headers: {
        authorization: `Bearer ${token}`,
        'x-correlation-id': 't17-followup-smoke',
      },
    });
    expect(res.headers['x-correlation-id']).toBe('t17-followup-smoke');
  });
});
