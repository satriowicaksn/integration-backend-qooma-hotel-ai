// End-to-end integration test for T20-followup RPC route landing.
// Boots the real Fastify server via `buildServer()` and drives it via
// `fastify.inject`. The Telegram Bot API is mocked by a second local
// Fastify instance bound to a random ephemeral port; `TELEGRAM_API_BASE`
// env is overridden to point at it (zero new deps; mirrors T17-followup
// integration pattern).

import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyInstance } from 'fastify';

import { resetConfigCache } from '@core/config/env.js';

import { encrypt } from '@shared/utils/crypto.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const RPC_SECRET = 's'.repeat(48);
const BOT_TOKEN = '987654321:AABBccDDEEffGGhh';

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('T20-followup route landing (integration)', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let app: FastifyInstance;
  let db: PrismaClient;
  let botApiMock: FastifyInstance;
  let botApiUrl: string;
  const mockCalls: Array<{ url: string; body: unknown }> = [];
  let mockResponder: (body: unknown) => { status: number; payload: unknown } = () => ({
    status: 200,
    payload: { ok: true, result: { message_id: 5555 } },
  });

  beforeAll(async () => {
    botApiMock = Fastify({ logger: false });
    botApiMock.post('/bot:token/sendMessage', async (req, reply) => {
      mockCalls.push({ url: req.url, body: req.body });
      const { status, payload } = mockResponder(req.body);
      return reply.code(status).send(payload);
    });
    await botApiMock.listen({ port: 0, host: '127.0.0.1' });
    const address = botApiMock.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('bot api mock listener has no address');
    }
    botApiUrl = `http://127.0.0.1:${address.port}`;

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
    process.env['INTERNAL_RPC_SECRET'] = RPC_SECRET;
    process.env['TELEGRAM_API_BASE'] = botApiUrl;
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
    if (botApiMock) await botApiMock.close();
    process.env = savedEnv;
    resetConfigCache();
  });

  beforeEach(async () => {
    await db.telegramConfig.deleteMany({});
    mockCalls.length = 0;
    mockResponder = () => ({ status: 200, payload: { ok: true, result: { message_id: 5555 } } });
  });

  async function seedConfig(): Promise<void> {
    await db.telegramConfig.create({
      data: {
        hotelId: HOTEL_ID,
        botTokenEnc: encrypt(BOT_TOKEN),
        botUsername: 'qooma_demo_bot',
        defaultChatId: '-100999',
        gmTelegramId: null,
        webhookUrl: null,
      },
    });
  }

  it('should return 401 canonical envelope when X-Internal-Secret is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rpc/send_telegram_message',
      headers: { 'content-type': 'application/json' },
      payload: { hotel_id: HOTEL_ID, chat_id: '-1001', body: 'test' },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('AUTH_ERROR');
  });

  it('should return 401 when X-Internal-Secret is wrong (timing-safe compare)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rpc/send_telegram_message',
      headers: { 'content-type': 'application/json', 'x-internal-secret': 'wrong' },
      payload: { hotel_id: HOTEL_ID, chat_id: '-1001', body: 'test' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 400 canonical envelope on zod validation failure', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rpc/send_telegram_message',
      headers: { 'content-type': 'application/json', 'x-internal-secret': RPC_SECRET },
      payload: { hotel_id: 'not-a-uuid', chat_id: '-1001', body: 'test' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 canonical envelope when no telegram config exists for the hotel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rpc/send_telegram_message',
      headers: { 'content-type': 'application/json', 'x-internal-secret': RPC_SECRET },
      payload: { hotel_id: HOTEL_ID, chat_id: '-1001', body: 'test' },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string; details: { resource: string } } }>();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.details.resource).toBe('telegram_config');
  });

  it('should dispatch to the Bot API and return { message_id, sent_at } on the happy path', async () => {
    await seedConfig();
    const res = await app.inject({
      method: 'POST',
      url: '/rpc/send_telegram_message',
      headers: { 'content-type': 'application/json', 'x-internal-secret': RPC_SECRET },
      payload: {
        hotel_id: HOTEL_ID,
        chat_id: '-1001234567890',
        body: 'Escalation: ticket #42',
        parse_mode: 'MarkdownV2',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ message_id: string; sent_at: string }>();
    expect(body.message_id).toBe('5555');
    expect(typeof body.sent_at).toBe('string');
    expect(new Date(body.sent_at).toString()).not.toBe('Invalid Date');

    expect(mockCalls).toHaveLength(1);
    expect(mockCalls[0]?.url).toBe(`/bot${BOT_TOKEN}/sendMessage`);
    expect(mockCalls[0]?.body).toEqual({
      chat_id: '-1001234567890',
      text: 'Escalation: ticket #42',
      parse_mode: 'MarkdownV2',
    });
  });

  it('should return 502 ExternalServiceError when the Bot API returns a 5xx', async () => {
    await seedConfig();
    mockResponder = () => ({ status: 500, payload: { ok: false, description: 'internal' } });

    const res = await app.inject({
      method: 'POST',
      url: '/rpc/send_telegram_message',
      headers: { 'content-type': 'application/json', 'x-internal-secret': RPC_SECRET },
      payload: { hotel_id: HOTEL_ID, chat_id: '-1001', body: 'x' },
    });
    expect(res.statusCode).toBe(502);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('EXTERNAL_SERVICE_ERROR');
  });

  it('should echo the inbound x-correlation-id on the RPC response', async () => {
    await seedConfig();
    const res = await app.inject({
      method: 'POST',
      url: '/rpc/send_telegram_message',
      headers: {
        'content-type': 'application/json',
        'x-internal-secret': RPC_SECRET,
        'x-correlation-id': 't20-followup-smoke',
      },
      payload: { hotel_id: HOTEL_ID, chat_id: '-1001', body: 'x' },
    });
    expect(res.headers['x-correlation-id']).toBe('t20-followup-smoke');
  });

  // Sanity: keep jest happy about the unused import.
  it('should hold the jest reference (linter satisfaction)', () => {
    expect(typeof jest.fn).toBe('function');
  });
});
