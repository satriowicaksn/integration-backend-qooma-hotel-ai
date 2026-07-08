// End-to-end integration test for T19-followup route landing.
// Boots the real Fastify server via `buildServer()`. Exercises:
//   slug lookup → tenant resolve → HMAC-equivalent secret compare →
//   raw-body persist to webhook_events → dispatch through the stubbed
//   HC ports → 200 ack. Skipped without `DATABASE_URL` per T17/T20/T23
//   followup precedent.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { resetConfigCache } from '@core/config/env.js';

import { encrypt } from '@shared/utils/crypto.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const HOTEL_SLUG = 'demo-hotel';
const BOT_TOKEN = '987654321:AABBccDDEEffGGhh';

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('T19-followup route landing (integration)', () => {
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
    process.env['JWT_ACCESS_SECRET'] = 'x'.repeat(48);
    process.env['JWT_REFRESH_SECRET'] = 'y'.repeat(48);
    process.env['ENCRYPTION_KEY'] = 'a'.repeat(64);
    process.env['ENCRYPTION_KEY_VERSION'] = 'v1';
    process.env['TELEGRAM_WEBHOOK_HOTEL_SLUG_MAP'] = JSON.stringify({ [HOTEL_SLUG]: HOTEL_ID });
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
    await db.webhookEvent.deleteMany({});
    await db.telegramConfig.deleteMany({});
  });

  async function seedConfig(): Promise<void> {
    await db.telegramConfig.create({
      data: {
        hotelId: HOTEL_ID,
        botTokenEnc: encrypt(BOT_TOKEN),
        botUsername: 'qooma_demo_bot',
        defaultChatId: null,
        gmTelegramId: null,
        webhookUrl: null,
      },
    });
  }

  function validUpdate(): Record<string, unknown> {
    return {
      update_id: 42,
      message: {
        message_id: 1,
        date: 1_720_000_000,
        chat: { id: 100 },
        from: { id: 123_456_789 },
        text: '/help',
      },
    };
  }

  it('should 404 canonical envelope when the hotel slug is unknown', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/telegram/unknown-slug',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': BOT_TOKEN,
      },
      payload: validUpdate(),
    });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('should 401 canonical envelope when the Telegram secret header is missing, and NOT persist a webhook_events row (binding #13)', async () => {
    await seedConfig();
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/telegram/${HOTEL_SLUG}`,
      headers: { 'content-type': 'application/json' },
      payload: validUpdate(),
    });
    expect(res.statusCode).toBe(401);
    const rows = await db.webhookEvent.findMany({ where: { hotelId: HOTEL_ID } });
    expect(rows).toHaveLength(0);
  });

  it('should 401 canonical envelope when the Telegram secret header is wrong (timing-safe)', async () => {
    await seedConfig();
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/telegram/${HOTEL_SLUG}`,
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': 'this-is-not-the-bot-token',
      },
      payload: validUpdate(),
    });
    expect(res.statusCode).toBe(401);
  });

  it('should 400 canonical envelope when the body fails zod validation', async () => {
    await seedConfig();
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/telegram/${HOTEL_SLUG}`,
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': BOT_TOKEN,
      },
      payload: { not_a_telegram_update: true },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should 200 { ok: true } and persist a webhook_events row on the happy path', async () => {
    await seedConfig();
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/telegram/${HOTEL_SLUG}`,
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': BOT_TOKEN,
      },
      payload: validUpdate(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ ok: boolean }>()).toEqual({ ok: true });

    const rows = await db.webhookEvent.findMany({ where: { hotelId: HOTEL_ID } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.provider).toBe('telegram');
    expect(rows[0]?.signatureValid).toBe(true);
    const payload = rows[0]?.payload as unknown as Record<string, unknown>;
    expect(payload['update_id']).toBe(42);
  });

  it('should echo the inbound x-correlation-id on the ack response', async () => {
    await seedConfig();
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/telegram/${HOTEL_SLUG}`,
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': BOT_TOKEN,
        'x-correlation-id': 't19-followup-smoke',
      },
      payload: validUpdate(),
    });
    expect(res.headers['x-correlation-id']).toBe('t19-followup-smoke');
  });
});
