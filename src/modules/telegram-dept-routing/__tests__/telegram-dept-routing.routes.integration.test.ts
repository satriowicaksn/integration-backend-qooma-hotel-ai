// End-to-end integration test for T18-followup route landing.
// Boots the real Fastify server via `buildServer()` and drives it via
// `fastify.inject`: JWT verify → gm_admin role check → env dept→hotel map
// resolves tenancy → stub write returns { updated: true } → 200 ack.
// Skipped without DATABASE_URL per T17/T19/T20/T23/T24-followup precedent.

import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

import { resetConfigCache } from '@core/config/env.js';

import { UpdateDepartmentTelegramRoutingResponseSchema } from '../telegram-dept-routing.schema.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const OTHER_HOTEL_ID = '99999999-9999-9999-9999-999999999999';
const DEPT_MINE = 'dept-hk-01';
const DEPT_OTHER = 'dept-hk-99'; // Belongs to OTHER_HOTEL_ID in the env map
const JWT_SECRET = 'x'.repeat(48);

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('T18-followup route landing (integration)', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let app: FastifyInstance;

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
    process.env['TELEGRAM_DEPT_ROUTING_MAP'] = JSON.stringify({
      [DEPT_MINE]: HOTEL_ID,
      [DEPT_OTHER]: OTHER_HOTEL_ID,
    });
    resetConfigCache();

    const apiModule = await import('../../../entrypoints/api-server.js');
    app = await apiModule.buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    process.env = savedEnv;
    resetConfigCache();
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

  it('should 401 canonical envelope on PUT without Authorization header', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/integrations/telegram/departments/${DEPT_MINE}`,
      payload: { telegram_chat_id: '-1001' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('AUTH_ERROR');
  });

  it('should 403 canonical envelope when the JWT role is not gm_admin', async () => {
    const token = signGmAdminJwt({ role: 'staff' });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/integrations/telegram/departments/${DEPT_MINE}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { telegram_chat_id: '-1001' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('FORBIDDEN');
  });

  it('should 404 canonical envelope when the dept slug is not in the env map', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/integrations/telegram/departments/unknown-dept',
      headers: { authorization: `Bearer ${token}` },
      payload: { telegram_chat_id: '-1001' },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string; details: { resource: string; id: string } } }>();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.details.resource).toBe('department');
    expect(body.error.details.id).toBe('unknown-dept');
  });

  it('should 404 with IDENTICAL shape on cross-tenant attempt (§4.10 anti-enumeration)', async () => {
    const token = signGmAdminJwt();
    const resCrossTenant = await app.inject({
      method: 'PUT',
      url: `/api/integrations/telegram/departments/${DEPT_OTHER}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { telegram_chat_id: '-1001' },
    });
    const resUnknown = await app.inject({
      method: 'PUT',
      url: '/api/integrations/telegram/departments/unknown-dept',
      headers: { authorization: `Bearer ${token}` },
      payload: { telegram_chat_id: '-1001' },
    });

    expect(resCrossTenant.statusCode).toBe(resUnknown.statusCode);
    expect(resCrossTenant.statusCode).toBe(404);

    const bodyCross = resCrossTenant.json<{
      error: { code: string; details: { resource: string } };
    }>();
    const bodyUnknown = resUnknown.json<{
      error: { code: string; details: { resource: string } };
    }>();
    expect(bodyCross.error.code).toBe(bodyUnknown.error.code);
    expect(bodyCross.error.details.resource).toBe(bodyUnknown.error.details.resource);
    // ID does differ (cross-tenant returns DEPT_OTHER, unknown returns 'unknown-dept'),
    // but the discriminating fields (code / resource / statusCode) match — enumeration
    // via response-shape difference is impossible.
  });

  it('should 400 canonical envelope when the body fails zod validation', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/integrations/telegram/departments/${DEPT_MINE}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 200 { updated: true, updated_at } on the happy path (stub write returns success)', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/integrations/telegram/departments/${DEPT_MINE}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { telegram_chat_id: '-1001234567890', supervisor_telegram_id: '987654321' },
    });
    expect(res.statusCode).toBe(200);
    // PM C ACK T18-fu binding #11: response must parse cleanly against the
    // primitive's authoritative schema.
    const parsed = UpdateDepartmentTelegramRoutingResponseSchema.parse(res.json());
    expect(parsed.updated).toBe(true);
    expect(new Date(parsed.updated_at).toString()).not.toBe('Invalid Date');
  });

  it('should return 200 on a partial update (supervisor-only) and schema-parse cleanly', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/integrations/telegram/departments/${DEPT_MINE}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { supervisor_telegram_id: '987654321' },
    });
    expect(res.statusCode).toBe(200);
    const parsed = UpdateDepartmentTelegramRoutingResponseSchema.parse(res.json());
    expect(parsed.updated).toBe(true);
  });

  it('should echo the inbound x-correlation-id on the response', async () => {
    const token = signGmAdminJwt();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/integrations/telegram/departments/${DEPT_MINE}`,
      headers: { authorization: `Bearer ${token}`, 'x-correlation-id': 't18-followup-smoke' },
      payload: { telegram_chat_id: '-1001' },
    });
    expect(res.headers['x-correlation-id']).toBe('t18-followup-smoke');
  });
});
