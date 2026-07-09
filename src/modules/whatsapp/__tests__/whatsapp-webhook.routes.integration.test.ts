// End-to-end integration test for T27 POST /webhook/whatsapp/:hotel_slug.
// Boots buildServer() so this exercises raw-body parsing → tenant resolve
// → HMAC verify (webhook_verify_token as secret per Q-A-04 parked) →
// webhook_events persist → per-message conversations upsert → stub HC +
// AI adapters → 200 sync ACK.
//
// Skips when DATABASE_URL is not set (runOrSkip pattern, binding #10).

import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { resetConfigCache } from '@core/config/env.js';

import { encrypt } from '@shared/utils/crypto.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const HOTEL_SLUG = 'test-hotel';
const VERIFY_TOKEN = 'meta-verify-token-t27';
const INTERNAL_SECRET = 'i'.repeat(48);
const SLUG_MAP = JSON.stringify({ [HOTEL_SLUG]: HOTEL_ID });

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('T27 WA inbound webhook (integration)', () => {
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
    process.env['INTERNAL_RPC_SECRET'] = INTERNAL_SECRET;
    process.env['WHATSAPP_WEBHOOK_HOTEL_SLUG_MAP'] = SLUG_MAP;
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

  async function cleanup(): Promise<void> {
    await db.message.deleteMany({});
    await db.conversation.deleteMany({});
    await db.webhookEvent.deleteMany({});
    await db.waConfig.deleteMany({});
  }

  beforeEach(async () => {
    await cleanup();
  });

  async function seedWaConfig(): Promise<void> {
    await db.waConfig.create({
      data: {
        hotelId: HOTEL_ID,
        bsp: '1engage',
        phoneNumberId: '1234567890',
        phoneNumber: '+6289999999999',
        accessTokenEnc: encrypt('plaintext-access-token'),
        webhookUrl: 'https://example.com/webhook',
        webhookVerifyToken: VERIFY_TOKEN,
      },
    });
  }

  function envelopeWith(
    messages: Array<{ from: string; body: string; id: string }>,
  ): Record<string, unknown> {
    return {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '+6289999999999', phone_number_id: '1234567890' },
                messages: messages.map((m) => ({
                  id: m.id,
                  from: m.from,
                  timestamp: '1720000000',
                  type: 'text',
                  text: { body: m.body },
                })),
              },
            },
          ],
        },
      ],
    };
  }

  function signBody(body: unknown, secret: string): { raw: string; header: string } {
    const raw = JSON.stringify(body);
    const digest = createHmac('sha256', secret).update(raw).digest('hex');
    return { raw, header: `sha256=${digest}` };
  }

  it('should return 404 canonical envelope when the URL slug is unknown (anti-enum BEFORE HMAC)', async () => {
    const { raw, header } = signBody(envelopeWith([]), VERIFY_TOKEN);
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/whatsapp/unknown-slug',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': header },
      payload: raw,
    });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('should return 401 canonical envelope when the X-Hub-Signature-256 header is missing', async () => {
    await seedWaConfig();
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/whatsapp/${HOTEL_SLUG}`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(envelopeWith([])),
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('AUTH_ERROR');
  });

  it('should return 401 canonical envelope when the X-Hub-Signature-256 header is wrong', async () => {
    await seedWaConfig();
    const env = envelopeWith([]);
    const raw = JSON.stringify(env);
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/whatsapp/${HOTEL_SLUG}`,
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=' + 'f'.repeat(64),
      },
      payload: raw,
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 200 { ok: true } and NOT persist when the envelope fails zod parse', async () => {
    await seedWaConfig();
    const bogusEnv = { object: 'not_whatsapp', entry: 'not-an-array' };
    const { raw, header } = signBody(bogusEnv, VERIFY_TOKEN);
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/whatsapp/${HOTEL_SLUG}`,
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': header },
      payload: raw,
    });
    // Sig valid → 400 VALIDATION_ERROR surfaces from ingestSync's zod parse.
    expect(res.statusCode).toBe(400);
    const rows = await db.webhookEvent.findMany({ where: { hotelId: HOTEL_ID } });
    expect(rows).toHaveLength(0);
  });

  it('should return 200 { ok: true } on a valid signed envelope + persist webhook_events + upsert conversations', async () => {
    await seedWaConfig();
    const env = envelopeWith([
      { from: '+6281234567890', body: 'Hello from Satrio', id: 'wamid.abc' },
    ]);
    const { raw, header } = signBody(env, VERIFY_TOKEN);
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/whatsapp/${HOTEL_SLUG}`,
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': header },
      payload: raw,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const events = await db.webhookEvent.findMany({ where: { hotelId: HOTEL_ID } });
    expect(events).toHaveLength(1);
    expect(events[0]?.provider).toBe('whatsapp');
    expect(events[0]?.signatureValid).toBe(true);

    const conversations = await db.conversation.findMany({ where: { hotelId: HOTEL_ID } });
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.guestWaPhone).toBe('+6281234567890');
    expect(conversations[0]?.unreadCount).toBe(1);
    expect(conversations[0]?.lastMessagePreview).toBe('Hello from Satrio');

    const messages = await db.message.findMany({ where: { conversationId: conversations[0]?.id } });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.direction).toBe('inbound');
    expect(messages[0]?.externalMessageId).toBe('wamid.abc');
    expect(messages[0]?.webhookEventId).toBe(events[0]?.id);
  });

  it('should echo the inbound x-correlation-id on the webhook response', async () => {
    await seedWaConfig();
    const env = envelopeWith([]);
    const { raw, header } = signBody(env, VERIFY_TOKEN);
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/whatsapp/${HOTEL_SLUG}`,
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': header,
        'x-correlation-id': 't27-fu-smoke',
      },
      payload: raw,
    });
    expect(res.headers['x-correlation-id']).toBe('t27-fu-smoke');
  });
});
