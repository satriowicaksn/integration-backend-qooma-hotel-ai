// End-to-end integration test for T28 /internal/wa/dispatch.
// Boots buildServer() with `WA_BSP_BASE_URL` pointed at an unreachable
// host so the T13 dispatch service exercises the meta_failed path
// (verifies both service composition + conversations upsert on failure)
// without needing a mock HTTP server or nock.
//
// Skips when DATABASE_URL is not set (runOrSkip pattern, binding #10).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { resetConfigCache } from '@core/config/env.js';

import { encrypt } from '@shared/utils/crypto.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const GUEST_ID = '22222222-3333-4444-5555-666666666666';
const INTERNAL_SECRET = 'i'.repeat(48);
// Unreachable target — axios connect fails immediately, T13 wraps into
// ExternalServiceError, dispatch service returns { kind: 'meta_failed' }.
const UNREACHABLE_BSP_BASE_URL = 'http://127.0.0.1:1';

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('T28 WA outbound dispatch RPC (integration)', () => {
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
    process.env['WA_BSP_BASE_URL'] = UNREACHABLE_BSP_BASE_URL;
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
    await db.message.deleteMany({});
    await db.conversation.deleteMany({});
    await db.outboundDispatch.deleteMany({});
    await db.waConfig.deleteMany({});
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
        webhookVerifyToken: 'verify-abc',
      },
    });
  }

  const validPayload = {
    hotel_id: HOTEL_ID,
    guest_id: GUEST_ID,
    to_wa_phone: '+6281234567890',
    body: 'hello staging',
  };

  it('should return 401 canonical envelope on dispatch without X-Internal-Secret header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/dispatch',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('AUTH_ERROR');
  });

  it('should return 401 canonical envelope on dispatch with a wrong X-Internal-Secret', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/dispatch',
      headers: { 'x-internal-secret': 'w'.repeat(48) },
      payload: validPayload,
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 400 VALIDATION_ERROR when the payload fails zod strict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/dispatch',
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      payload: { hotel_id: 'not-a-uuid' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 NOT_FOUND when the hotel has no WA config row', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/dispatch',
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      payload: validPayload,
    });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('should return kind=meta_failed and persist an outbound message with status=failed when the BSP is unreachable', async () => {
    await seedWaConfig();

    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/dispatch',
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      payload: validPayload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ kind: string; dispatch_id: string }>();
    expect(body.kind).toBe('meta_failed');
    expect(body.dispatch_id).toBeDefined();

    // T13 dispatch queue row got persisted then marked failed.
    const dispatchRows = await db.outboundDispatch.findMany({ where: { hotelId: HOTEL_ID } });
    expect(dispatchRows).toHaveLength(1);
    expect(dispatchRows[0]?.status).toBe('failed');

    // T29 conversations messages row got upserted with status=failed
    // (link back via dispatchId FK).
    const messages = await db.message.findMany({ where: { dispatchId: body.dispatch_id } });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.status).toBe('failed');
    expect(messages[0]?.direction).toBe('outbound');
    expect(messages[0]?.body).toBe('hello staging');

    // Conversation row got the preview + timestamp (no unread bump).
    const conversations = await db.conversation.findMany({ where: { hotelId: HOTEL_ID } });
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.unreadCount).toBe(0);
    expect(conversations[0]?.lastMessagePreview).toBe('hello staging');
  });

  it('should echo the inbound x-correlation-id on the dispatch response', async () => {
    await seedWaConfig();
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/dispatch',
      headers: {
        'x-internal-secret': INTERNAL_SECRET,
        'x-correlation-id': 't28-fu-smoke',
      },
      payload: validPayload,
    });
    expect(res.headers['x-correlation-id']).toBe('t28-fu-smoke');
  });
});
