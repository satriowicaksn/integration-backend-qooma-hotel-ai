// End-to-end integration test for T29 WA conversation internal RPC routes.
// Boots the real Fastify server via buildServer() so it exercises:
//   internalRpcAuthGuard → zod parse → repository tenancy check →
//   service list → wire mapping → canonical error envelope.
//
// Two CRITICAL bindings covered here (per PM C ACK):
//   #14 anti-enumeration: cross-tenant conversationId returns a 404
//        envelope BYTE-IDENTICAL to unknown conversationId.
//   #10 runOrSkip pattern for DB-touching integration tests.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { resetConfigCache } from '@core/config/env.js';

const HOTEL_A = '11111111-2222-3333-4444-555555555555';
const HOTEL_B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const WA_CONFIG_A = '22222222-3333-4444-5555-666666666666';
const WA_CONFIG_B = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
const UNKNOWN_CONVERSATION_ID = 'cccccccc-dddd-eeee-ffff-000000000000';
const INTERNAL_SECRET = 'i'.repeat(48);

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('T29 WA conversations internal RPC (integration)', () => {
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
    process.env['JWT_ACCESS_SECRET'] = 'x'.repeat(48);
    process.env['JWT_REFRESH_SECRET'] = 'y'.repeat(48);
    process.env['ENCRYPTION_KEY'] = 'a'.repeat(64);
    process.env['ENCRYPTION_KEY_VERSION'] = 'v1';
    process.env['INTERNAL_RPC_SECRET'] = INTERNAL_SECRET;
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
  });

  async function seedConversation(
    hotelId: string,
    waConfigId: string,
    phone: string,
  ): Promise<string> {
    const conv = await db.conversation.create({
      data: {
        hotelId,
        waConfigId,
        guestWaPhone: phone,
        lastMessageAt: new Date('2026-07-08T00:00:00.000Z'),
        lastMessagePreview: 'hi',
        unreadCount: 1,
      },
    });
    await db.message.create({
      data: {
        conversationId: conv.id,
        direction: 'inbound',
        body: 'hi',
        status: 'received',
        receivedAt: new Date('2026-07-08T00:00:00.000Z'),
      },
    });
    return conv.id;
  }

  it('should return 401 canonical envelope on conversations.list without X-Internal-Secret header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/conversations.list',
      payload: { hotel_id: HOTEL_A },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('AUTH_ERROR');
  });

  it('should return 401 canonical envelope on messages.list without X-Internal-Secret header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/messages.list',
      payload: { hotel_id: HOTEL_A, conversation_id: UNKNOWN_CONVERSATION_ID },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('AUTH_ERROR');
  });

  it('should return 401 canonical envelope on conversations.list with a wrong X-Internal-Secret', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/conversations.list',
      headers: { 'x-internal-secret': 'w'.repeat(48) },
      payload: { hotel_id: HOTEL_A },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 200 with an empty page when no conversations exist for the hotel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/conversations.list',
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      payload: { hotel_id: HOTEL_A },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: unknown[]; next_cursor: string | null }>();
    expect(body.items).toEqual([]);
    expect(body.next_cursor).toBeNull();
  });

  it('should return the seeded conversation with wire-shape snake_case fields', async () => {
    const convId = await seedConversation(HOTEL_A, WA_CONFIG_A, '+6281234567890');

    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/conversations.list',
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      payload: { hotel_id: HOTEL_A },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      items: Array<{ id: string; hotel_id: string; guest_wa_phone: string; unread_count: number }>;
      next_cursor: string | null;
    }>();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(convId);
    expect(body.items[0]?.hotel_id).toBe(HOTEL_A);
    expect(body.items[0]?.guest_wa_phone).toBe('+6281234567890');
    expect(body.items[0]?.unread_count).toBe(1);
  });

  it('should return 404 NOT_FOUND envelope on messages.list when the conversation does NOT exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/messages.list',
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      payload: {
        hotel_id: HOTEL_A,
        conversation_id: UNKNOWN_CONVERSATION_ID,
      },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('should return a BYTE-IDENTICAL 404 envelope on cross-tenant messages.list (anti-enumeration binding #14)', async () => {
    const convInHotelB = await seedConversation(HOTEL_B, WA_CONFIG_B, '+6281234567891');

    const crossTenant = await app.inject({
      method: 'POST',
      url: '/internal/wa/messages.list',
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      payload: { hotel_id: HOTEL_A, conversation_id: convInHotelB },
    });
    const unknown = await app.inject({
      method: 'POST',
      url: '/internal/wa/messages.list',
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      payload: { hotel_id: HOTEL_A, conversation_id: convInHotelB },
    });

    expect(crossTenant.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    // Byte-identical response body shape — attacker can NOT distinguish
    // "conversation exists in another tenant" from "conversation does not exist".
    expect(crossTenant.body).toBe(unknown.body);
  });

  it('should return 200 with a seeded message when the conversation is in the caller hotel', async () => {
    const convId = await seedConversation(HOTEL_A, WA_CONFIG_A, '+6281234567892');

    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/messages.list',
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      payload: { hotel_id: HOTEL_A, conversation_id: convId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      items: Array<{ conversation_id: string; direction: string; body: string | null }>;
      next_cursor: string | null;
    }>();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.conversation_id).toBe(convId);
    expect(body.items[0]?.direction).toBe('inbound');
  });

  it('should return 400 VALIDATION_ERROR when the payload fails zod strict parse', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/conversations.list',
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      payload: { hotel_id: 'not-a-uuid' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 VALIDATION_ERROR when the cursor is malformed base64', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/wa/conversations.list',
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      payload: { hotel_id: HOTEL_A, cursor: 'not-valid-cursor-payload' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
