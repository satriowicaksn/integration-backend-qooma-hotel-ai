// End-to-end integration test for T26 WA config routes.
// Boots buildServer() so this exercises:
//   jwtAuthGuard → requireRole('gm_admin') → tenant scope → zod
//   validation → WhatsappConfigService → encrypt + persist → decrypt +
//   mask on read-back.
//
// Skips when DATABASE_URL is not set (runOrSkip pattern, binding #10).

import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { resetConfigCache } from '@core/config/env.js';

import { decrypt } from '@shared/utils/crypto.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const JWT_SECRET = 'x'.repeat(48);
const PLAINTEXT_ACCESS_TOKEN = 'plaintext-access-token-abcdef123';
const PLAINTEXT_WEBHOOK_VERIFY_TOKEN = 'plaintext-webhook-verify-abc';

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('T26 WA config route landing (integration)', () => {
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
    process.env['INTERNAL_RPC_SECRET'] = 'i'.repeat(48);
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

  const validPutBody = {
    bsp: '1engage' as const,
    phoneNumberId: '1234567890',
    phoneNumber: '+6281234567890',
    accessToken: PLAINTEXT_ACCESS_TOKEN,
    webhookUrl: 'https://example.com/webhook',
    webhookVerifyToken: PLAINTEXT_WEBHOOK_VERIFY_TOKEN,
  };

  it('should return 401 canonical envelope on GET without Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/integrations/whatsapp' });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('AUTH_ERROR');
  });

  it('should return 403 canonical envelope when the JWT role is not gm_admin', async () => {
    const token = signGmAdminJwt({ role: 'staff' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/whatsapp',
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
      url: '/api/integrations/whatsapp',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string; details: { resource: string; id: string } } }>();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.details.resource).toBe('WaConfig');
    expect(body.error.details.id).toBe(HOTEL_ID);
  });

  it('should PUT then GET a config and mask both accessToken and webhookVerifyToken on the response', async () => {
    const token = signGmAdminJwt();

    const put = await app.inject({
      method: 'PUT',
      url: '/api/integrations/whatsapp',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: validPutBody,
    });
    expect(put.statusCode).toBe(200);
    const putBody = put.json<{
      accessToken: string;
      webhookVerifyToken: string;
      hotelId: string;
    }>();
    expect(putBody.hotelId).toBe(HOTEL_ID);
    expect(putBody.accessToken).not.toContain(PLAINTEXT_ACCESS_TOKEN);
    expect(putBody.webhookVerifyToken).not.toContain(PLAINTEXT_WEBHOOK_VERIFY_TOKEN);

    const get = await app.inject({
      method: 'GET',
      url: '/api/integrations/whatsapp',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);
    const getBody = get.json<{
      accessToken: string;
      webhookVerifyToken: string;
      hotelId: string;
    }>();
    expect(getBody.hotelId).toBe(HOTEL_ID);
    expect(getBody.accessToken).toBe(putBody.accessToken);
    expect(getBody.accessToken).not.toContain(PLAINTEXT_ACCESS_TOKEN);
    expect(getBody.webhookVerifyToken).not.toContain(PLAINTEXT_WEBHOOK_VERIFY_TOKEN);
  });

  it('should persist the accessToken encrypted at rest and decrypt back to the plaintext (idempotency check)', async () => {
    const token = signGmAdminJwt();

    const first = await app.inject({
      method: 'PUT',
      url: '/api/integrations/whatsapp',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: validPutBody,
    });
    expect(first.statusCode).toBe(200);
    const rowAfterFirst = await db.waConfig.findUnique({ where: { hotelId: HOTEL_ID } });
    if (rowAfterFirst === null) throw new Error('expected row after first PUT');
    expect(rowAfterFirst.accessTokenEnc.startsWith('v1:')).toBe(true);
    expect(decrypt(rowAfterFirst.accessTokenEnc)).toBe(PLAINTEXT_ACCESS_TOKEN);

    // Second PUT with the same payload: still one row, decrypt still
    // equals the plaintext (ciphertext may differ due to random IV).
    const second = await app.inject({
      method: 'PUT',
      url: '/api/integrations/whatsapp',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: validPutBody,
    });
    expect(second.statusCode).toBe(200);

    const rowCount = await db.waConfig.count({ where: { hotelId: HOTEL_ID } });
    expect(rowCount).toBe(1);
    const rowAfterSecond = await db.waConfig.findUnique({ where: { hotelId: HOTEL_ID } });
    if (rowAfterSecond === null) throw new Error('expected row after second PUT');
    expect(decrypt(rowAfterSecond.accessTokenEnc)).toBe(PLAINTEXT_ACCESS_TOKEN);
  });

  it('should reject a PUT with an invalid body via zod validation', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/integrations/whatsapp',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { ...validPutBody, phoneNumber: '081-not-e164' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should echo the inbound x-correlation-id on the response', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/whatsapp',
      headers: {
        authorization: `Bearer ${token}`,
        'x-correlation-id': 't26-fu-smoke',
      },
    });
    expect(res.headers['x-correlation-id']).toBe('t26-fu-smoke');
  });
});
