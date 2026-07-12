// End-to-end integration test for T23-followup route landing.
// Boots the real Fastify server via `buildServer()` and drives it via
// `fastify.inject`: JWT verify → tenant scope → 4 reader adapters → real
// Postgres → aggregator service → snake_case wire mapping → response
// envelope → correlation-id round-trip.

import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { resetConfigCache } from '@core/config/env.js';

import { encrypt } from '@shared/utils/crypto.js';

import { IntegrationOverviewResponseSchema } from '../integration-overview.schema.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const JWT_SECRET = 'x'.repeat(48);

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('T23 route landing (integration)', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let app: FastifyInstance;
  let db: PrismaClient;

  beforeAll(async () => {
    savedEnv = { ...process.env };
    process.env['NODE_ENV'] = 'development';
    process.env['LOG_LEVEL'] = 'error';
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
    await db.qrState.deleteMany({});
    await db.telegramConfig.deleteMany({});
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
      hotelId: HOTEL_ID,
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
    const res = await app.inject({ method: 'GET', url: '/api/integrations' });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('AUTH_ERROR');
  });

  it('should return 403 canonical envelope when the JWT role is not gm_admin', async () => {
    const token = signGmAdminJwt({ role: 'staff' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('should return 200 with all subsystems null and all-down health when nothing is configured', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      whatsapp: unknown;
      telegram: unknown;
      qr: unknown;
      health: {
        whatsapp: { status: string };
        telegram: { status: string };
        claude_api: { status: string };
      };
    }>();
    expect(body.whatsapp).toBeNull();
    expect(body.telegram).toBeNull();
    expect(body.qr).toBeNull();
    expect(body.health.whatsapp.status).toBe('down');
    expect(body.health.telegram.status).toBe('down');
    expect(body.health.claude_api.status).toBe('down');
  });

  it('should return 200 with fully-populated subsystems when all four are seeded', async () => {
    await db.waConfig.create({
      data: {
        hotelId: HOTEL_ID,
        bsp: '1engage',
        phoneNumberId: 'pnid-1',
        phoneNumber: '+62800001111',
        accessTokenEnc: encrypt('wa-access-token'),
        webhookUrl: 'https://example.com/wa',
        webhookVerifyToken: 'z'.repeat(32),
        verifiedAt: new Date('2026-07-05T10:00:00Z'),
      },
    });
    await db.telegramConfig.create({
      data: {
        hotelId: HOTEL_ID,
        botTokenEnc: encrypt('123:AAA'),
        botUsername: 'qooma_demo_bot',
        defaultChatId: '-100999',
        gmTelegramId: null,
        webhookUrl: 'https://example.com/tg',
      },
    });
    await db.qrState.create({
      data: {
        hotelId: HOTEL_ID,
        waLink: 'https://wa.me/62800001111',
        pngUrl: 'https://cdn.qooma.example/qr/hotel-1.png',
        generatedAt: new Date('2026-07-06T12:34:56Z'),
      },
    });
    await db.channelHealthSnapshot.createMany({
      data: [
        {
          hotelId: HOTEL_ID,
          provider: 'whatsapp',
          status: 'healthy',
          latencyMs: 120,
        },
        {
          hotelId: HOTEL_ID,
          provider: 'telegram',
          status: 'degraded',
          latencyMs: 350,
        },
        {
          hotelId: HOTEL_ID,
          provider: 'claude_api',
          status: 'healthy',
          latencyMs: 800,
        },
      ],
    });

    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      whatsapp: {
        bsp: string;
        phone_number: string;
        verified_at: string | null;
        has_access_token: boolean;
        webhook_url: string | null;
      };
      telegram: {
        bot_username: string;
        has_bot_token: boolean;
        default_chat_id: string | null;
        webhook_url: string | null;
      };
      qr: { url: string; png_url: string; generated_at: string };
      health: {
        whatsapp: { status: string };
        telegram: { status: string };
        claude_api: { status: string; last_check_at: string };
      };
    }>();
    expect(body.whatsapp.bsp).toBe('1engage');
    expect(body.whatsapp.phone_number).toBe('+62800001111');
    expect(body.whatsapp.has_access_token).toBe(true);
    expect(body.whatsapp.webhook_url).toBe('https://example.com/wa');
    expect(body.whatsapp.verified_at).toBe('2026-07-05T10:00:00.000Z');
    expect(body.telegram.bot_username).toBe('qooma_demo_bot');
    expect(body.telegram.has_bot_token).toBe(true);
    expect(body.telegram.default_chat_id).toBe('-100999');
    expect(body.qr.url).toBe('https://wa.me/62800001111');
    expect(body.qr.png_url).toBe('https://cdn.qooma.example/qr/hotel-1.png');
    expect(body.qr.generated_at).toBe('2026-07-06T12:34:56.000Z');
    expect(body.health.whatsapp.status).toBe('healthy');
    expect(body.health.telegram.status).toBe('degraded');
    expect(body.health.claude_api.status).toBe('healthy');

    // PM C ACK T23-followup binding #7: response must parse cleanly
    // against the primitive's authoritative schema.
    expect(() => IntegrationOverviewResponseSchema.parse(res.json())).not.toThrow();
  });

  it('should return partial subsystems when only some are configured', async () => {
    await db.telegramConfig.create({
      data: {
        hotelId: HOTEL_ID,
        botTokenEnc: encrypt('123:AAA'),
        botUsername: 'qooma_demo_bot',
        defaultChatId: null,
        gmTelegramId: null,
        webhookUrl: null,
      },
    });

    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      whatsapp: unknown;
      telegram: { bot_username: string };
      qr: unknown;
    }>();
    expect(body.whatsapp).toBeNull();
    expect(body.qr).toBeNull();
    expect(body.telegram.bot_username).toBe('qooma_demo_bot');
  });

  it('should echo the inbound x-correlation-id on the response', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations',
      headers: { authorization: `Bearer ${token}`, 'x-correlation-id': 't23-followup-smoke' },
    });
    expect(res.headers['x-correlation-id']).toBe('t23-followup-smoke');
  });
});
