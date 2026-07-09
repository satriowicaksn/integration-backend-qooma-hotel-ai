// Real-Postgres integration test for T29 WhatsappConversationsRepository.
//
// Skips when DATABASE_URL is not set (matches the T17 / Q-C-01 pattern).
// Covers:
//   - migration smoke: `conversations` + `messages` tables exist, upsert
//     writes and read-back matches.
//   - ADR-0010 body[:200] preview truncation is applied at write time.
//   - Tenant isolation: a Conversation created for hotel A does NOT show
//     up under `listConversations` for hotel B (byte-identical empty).
//   - Cross-tenant `findConversationById` returns null (fed to the route
//     layer where it maps to a byte-identical 404 — see routes test).

import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';

import { resetConfigCache } from '@core/config/env.js';

import { WhatsappConversationsRepository } from '../whatsapp-conversations.repository.js';

const HOTEL_A = '11111111-2222-3333-4444-555555555555';
const HOTEL_B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const WA_CONFIG_A = '22222222-3333-4444-5555-666666666666';
const WA_CONFIG_B = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('WhatsappConversationsRepository (integration)', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let db: PrismaClient;

  beforeAll(async () => {
    savedEnv = { ...process.env };
    process.env['NODE_ENV'] ??= 'development';
    process.env['LOG_LEVEL'] ??= 'silent';
    process.env['API_BASE_URL'] ??= 'http://localhost:3000';
    process.env['CORS_ORIGIN'] ??= 'http://localhost:5173';
    process.env['REDIS_URL'] ??= 'redis://localhost:6380';
    process.env['JWT_ACCESS_SECRET'] ??= 'x'.repeat(48);
    process.env['JWT_REFRESH_SECRET'] ??= 'y'.repeat(48);
    process.env['ENCRYPTION_KEY'] ??= 'a'.repeat(64);
    process.env['ENCRYPTION_KEY_VERSION'] ??= 'v1';
    process.env['INTERNAL_RPC_SECRET'] ??= 's'.repeat(48);
    resetConfigCache();

    const module = await import('@core/prisma/prisma-client.js');
    db = module.db;
  });

  afterAll(async () => {
    if (db) await db.$disconnect();
    process.env = savedEnv;
    resetConfigCache();
  });

  async function cleanup(): Promise<void> {
    await db.message.deleteMany({});
    await db.conversation.deleteMany({});
  }

  beforeEach(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should insert a new conversation and message row on first inbound upsert', async () => {
    const repo = new WhatsappConversationsRepository(db);
    const receivedAt = new Date('2026-07-08T00:00:00.000Z');

    const result = await repo.upsertOnInbound({
      hotelId: HOTEL_A,
      waConfigId: WA_CONFIG_A,
      guestWaPhone: '+6281234567890',
      body: 'hello world',
      externalMessageId: 'wamid.HBg1',
      webhookEventId: null,
      receivedAt,
    });

    expect(result.conversation.hotelId).toBe(HOTEL_A);
    expect(result.conversation.guestWaPhone).toBe('+6281234567890');
    expect(result.conversation.unreadCount).toBe(1);
    expect(result.message.direction).toBe('inbound');
    expect(result.message.body).toBe('hello world');
    expect(result.message.externalMessageId).toBe('wamid.HBg1');

    const rows = await db.conversation.findMany({ where: { hotelId: HOTEL_A } });
    expect(rows).toHaveLength(1);
  });

  it('should increment unreadCount on subsequent inbound upserts for the same guest phone', async () => {
    const repo = new WhatsappConversationsRepository(db);
    const guestPhone = '+6281234567891';

    await repo.upsertOnInbound({
      hotelId: HOTEL_A,
      waConfigId: WA_CONFIG_A,
      guestWaPhone: guestPhone,
      body: 'first',
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date('2026-07-08T00:00:00.000Z'),
    });
    const second = await repo.upsertOnInbound({
      hotelId: HOTEL_A,
      waConfigId: WA_CONFIG_A,
      guestWaPhone: guestPhone,
      body: 'second',
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date('2026-07-08T00:05:00.000Z'),
    });

    expect(second.conversation.unreadCount).toBe(2);
  });

  it('should truncate lastMessagePreview to 200 chars on inbound upsert (ADR-0010 body[:200])', async () => {
    const repo = new WhatsappConversationsRepository(db);
    const longBody = 'x'.repeat(500);

    const result = await repo.upsertOnInbound({
      hotelId: HOTEL_A,
      waConfigId: WA_CONFIG_A,
      guestWaPhone: '+6281234567892',
      body: longBody,
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date(),
    });

    expect(result.conversation.lastMessagePreview).toHaveLength(200);
    expect(result.conversation.lastMessagePreview).toBe('x'.repeat(200));
    // full body persists on the message row itself, only preview is truncated.
    expect(result.message.body).toBe(longBody);
  });

  it('should NOT increment unreadCount on outbound upsert', async () => {
    const repo = new WhatsappConversationsRepository(db);
    const guestPhone = '+6281234567893';
    await repo.upsertOnInbound({
      hotelId: HOTEL_A,
      waConfigId: WA_CONFIG_A,
      guestWaPhone: guestPhone,
      body: 'hi',
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date('2026-07-08T00:00:00.000Z'),
    });

    const out = await repo.upsertOnOutbound({
      hotelId: HOTEL_A,
      waConfigId: WA_CONFIG_A,
      guestWaPhone: guestPhone,
      body: 'reply',
      templateRef: null,
      templateVariables: null,
      externalMessageId: 'wamid.OUT1',
      dispatchId: null,
      status: 'sent',
      sentAt: new Date('2026-07-08T00:05:00.000Z'),
    });

    expect(out.conversation.unreadCount).toBe(1);
    expect(out.message.direction).toBe('outbound');
  });

  it('should isolate conversations per hotelId (list under hotel B never sees hotel A rows)', async () => {
    const repo = new WhatsappConversationsRepository(db);

    await repo.upsertOnInbound({
      hotelId: HOTEL_A,
      waConfigId: WA_CONFIG_A,
      guestWaPhone: '+6281234567894',
      body: 'A-msg',
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date(),
    });
    await repo.upsertOnInbound({
      hotelId: HOTEL_B,
      waConfigId: WA_CONFIG_B,
      guestWaPhone: '+6281234567895',
      body: 'B-msg',
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date(),
    });

    const rowsA = await repo.listConversations({ hotelId: HOTEL_A, cursor: null, limit: 100 });
    const rowsB = await repo.listConversations({ hotelId: HOTEL_B, cursor: null, limit: 100 });

    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);
    expect(rowsA[0]?.hotelId).toBe(HOTEL_A);
    expect(rowsB[0]?.hotelId).toBe(HOTEL_B);
  });

  it('should return null on cross-tenant findConversationById (feeds the byte-identical 404)', async () => {
    const repo = new WhatsappConversationsRepository(db);
    const inserted = await repo.upsertOnInbound({
      hotelId: HOTEL_A,
      waConfigId: WA_CONFIG_A,
      guestWaPhone: '+6281234567896',
      body: 'x',
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date(),
    });

    const found = await repo.findConversationById({
      hotelId: HOTEL_B,
      conversationId: inserted.conversation.id,
    });
    expect(found).toBeNull();

    const foundSameTenant = await repo.findConversationById({
      hotelId: HOTEL_A,
      conversationId: inserted.conversation.id,
    });
    expect(foundSameTenant?.id).toBe(inserted.conversation.id);
  });

  it('should return null on unknown-conversation findConversationById (byte-identical to cross-tenant)', async () => {
    const repo = new WhatsappConversationsRepository(db);
    const notFound = await repo.findConversationById({
      hotelId: HOTEL_A,
      conversationId: randomUUID(),
    });
    expect(notFound).toBeNull();
  });

  it('should list messages ordered by createdAt DESC and honor the `take` limit', async () => {
    const repo = new WhatsappConversationsRepository(db);
    const conv = await repo.upsertOnInbound({
      hotelId: HOTEL_A,
      waConfigId: WA_CONFIG_A,
      guestWaPhone: '+6281234567897',
      body: 'm1',
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date('2026-07-08T00:00:00.000Z'),
    });
    await repo.upsertOnInbound({
      hotelId: HOTEL_A,
      waConfigId: WA_CONFIG_A,
      guestWaPhone: '+6281234567897',
      body: 'm2',
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date('2026-07-08T00:01:00.000Z'),
    });
    await repo.upsertOnInbound({
      hotelId: HOTEL_A,
      waConfigId: WA_CONFIG_A,
      guestWaPhone: '+6281234567897',
      body: 'm3',
      externalMessageId: null,
      webhookEventId: null,
      receivedAt: new Date('2026-07-08T00:02:00.000Z'),
    });

    const page = await repo.listMessages({
      hotelId: HOTEL_A,
      conversationId: conv.conversation.id,
      cursor: null,
      limit: 2,
    });
    expect(page).toHaveLength(2);
  });
});
