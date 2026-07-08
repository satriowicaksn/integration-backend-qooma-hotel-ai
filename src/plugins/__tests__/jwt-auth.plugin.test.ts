import { createHmac } from 'node:crypto';

import { describe, expect, it } from '@jest/globals';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerErrorHandler } from '../error-handler.plugin.js';
import {
  extractBearerToken,
  jwtAuthGuard,
  requireRole,
  verifyJwt,
  type JwtPayload,
  type UserRole,
} from '../jwt-auth.plugin.js';

const SECRET = 'x'.repeat(48);
const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

function base64Url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b.toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signHs256(
  payload: Partial<JwtPayload> & { role?: UserRole; hotel_id?: string; exp?: number },
  secret = SECRET,
  header: Record<string, unknown> = { alg: 'HS256', typ: 'JWT' },
): string {
  const now = Math.floor(Date.now() / 1000);
  const finalPayload = {
    sub: 'user-1',
    hotel_id: HOTEL_ID,
    role: 'gm_admin',
    exp: now + 3600,
    iat: now,
    ...payload,
  };
  const h = base64Url(JSON.stringify(header));
  const p = base64Url(JSON.stringify(finalPayload));
  const sig = base64Url(createHmac('sha256', secret).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}

describe('extractBearerToken (pure)', () => {
  it('should extract the token when the header is a well-formed Bearer value', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('should accept lowercase "bearer" prefix', () => {
    expect(extractBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('should return undefined when the header is missing', () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
  });

  it('should return undefined when the value is empty', () => {
    expect(extractBearerToken('')).toBeUndefined();
  });

  it('should return undefined when the Bearer prefix is absent', () => {
    expect(extractBearerToken('Token abc.def')).toBeUndefined();
  });

  it('should return undefined when Bearer prefix is present but token is blank', () => {
    expect(extractBearerToken('Bearer    ')).toBeUndefined();
  });

  it('should pick the first value when the header is an array', () => {
    expect(extractBearerToken(['Bearer a.b.c', 'Bearer x.y.z'])).toBe('a.b.c');
  });
});

describe('verifyJwt (pure)', () => {
  it('should return the payload when the token is valid + not expired', () => {
    const token = signHs256({ role: 'gm_admin' });
    const decoded = verifyJwt(token, SECRET);
    expect(decoded).not.toBeNull();
    expect(decoded?.role).toBe('gm_admin');
    expect(decoded?.hotel_id).toBe(HOTEL_ID);
    expect(decoded?.sub).toBe('user-1');
  });

  it('should return null when the token is expired', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signHs256({ exp: now - 10 });
    expect(verifyJwt(token, SECRET)).toBeNull();
  });

  it('should return null when the signature is tampered', () => {
    const token = signHs256({});
    const parts = token.split('.');
    parts[2] = base64Url('tampered-signature');
    expect(verifyJwt(parts.join('.'), SECRET)).toBeNull();
  });

  it('should return null when the payload is tampered but signature is left original', () => {
    const token = signHs256({ role: 'staff' });
    const parts = token.split('.');
    parts[1] = base64Url(
      JSON.stringify({ sub: 'x', hotel_id: HOTEL_ID, role: 'gm_admin', exp: 9999999999 }),
    );
    expect(verifyJwt(parts.join('.'), SECRET)).toBeNull();
  });

  it('should return null when the algorithm claim is not HS256', () => {
    const token = signHs256({}, SECRET, { alg: 'none', typ: 'JWT' });
    expect(verifyJwt(token, SECRET)).toBeNull();
  });

  it('should return null when the header is malformed base64', () => {
    expect(verifyJwt('!!!.def.ghi', SECRET)).toBeNull();
  });

  it('should return null when there are fewer than 3 parts', () => {
    expect(verifyJwt('only.one', SECRET)).toBeNull();
    expect(verifyJwt('single', SECRET)).toBeNull();
  });

  it('should return null when the role claim is not a known role', () => {
    const token = signHs256({ role: 'attacker' as UserRole });
    expect(verifyJwt(token, SECRET)).toBeNull();
  });

  it('should return null when hotel_id is empty', () => {
    const token = signHs256({ hotel_id: '' });
    expect(verifyJwt(token, SECRET)).toBeNull();
  });

  it('should never authenticate against a blank secret (misconfig defense)', () => {
    const token = signHs256({});
    expect(verifyJwt(token, '')).toBeNull();
  });

  it('should return null when secret is wrong', () => {
    const token = signHs256({}, SECRET);
    expect(verifyJwt(token, 'different-secret')).toBeNull();
  });
});

interface Harness {
  app: FastifyInstance;
  didHandlerRun: () => boolean;
  seenUser: () => JwtPayload | undefined;
  seenHotelId: () => string | undefined;
}

async function buildApp(preHandlers: unknown[]): Promise<Harness> {
  let handlerRan = false;
  let capturedUser: JwtPayload | undefined;
  let capturedHotelId: string | undefined;
  const app = Fastify();
  registerErrorHandler(app);
  app.get('/protected', { preHandler: preHandlers as never }, (req) => {
    handlerRan = true;
    capturedUser = req.user;
    capturedHotelId = req.hotelId;
    return { ok: true };
  });
  await app.ready();
  return {
    app,
    didHandlerRun: () => handlerRan,
    seenUser: () => capturedUser,
    seenHotelId: () => capturedHotelId,
  };
}

describe('jwtAuthGuard (fastify.inject)', () => {
  it('should return 200 and populate req.user + req.hotelId with a valid token', async () => {
    const guard = jwtAuthGuard({ secret: SECRET });
    const { app, didHandlerRun, seenUser, seenHotelId } = await buildApp([guard]);
    const token = signHs256({ role: 'gm_admin' });

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(didHandlerRun()).toBe(true);
    expect(seenUser()?.role).toBe('gm_admin');
    expect(seenHotelId()).toBe(HOTEL_ID);
    await app.close();
  });

  it('should return 401 with canonical envelope when the Authorization header is missing', async () => {
    const guard = jwtAuthGuard({ secret: SECRET });
    const { app, didHandlerRun } = await buildApp([guard]);

    const res = await app.inject({ method: 'GET', url: '/protected' });

    expect(res.statusCode).toBe(401);
    expect(didHandlerRun()).toBe(false);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('AUTH_ERROR');
    await app.close();
  });

  it('should return 401 when the token is expired', async () => {
    const guard = jwtAuthGuard({ secret: SECRET });
    const { app, didHandlerRun } = await buildApp([guard]);
    const now = Math.floor(Date.now() / 1000);
    const token = signHs256({ exp: now - 5 });

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    expect(didHandlerRun()).toBe(false);
    await app.close();
  });

  it('should return 401 when the token was signed with a different secret', async () => {
    const guard = jwtAuthGuard({ secret: SECRET });
    const { app, didHandlerRun } = await buildApp([guard]);
    const token = signHs256({}, 'y'.repeat(48));

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    expect(didHandlerRun()).toBe(false);
    await app.close();
  });
});

describe('requireRole (fastify.inject)', () => {
  it('should return 200 when the session role matches the allowed set', async () => {
    const guards = [jwtAuthGuard({ secret: SECRET }), requireRole('gm_admin')];
    const { app, didHandlerRun } = await buildApp(guards);
    const token = signHs256({ role: 'gm_admin' });

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(didHandlerRun()).toBe(true);
    await app.close();
  });

  it('should return 200 when the role is super_admin (spec §8 all-access)', async () => {
    const guards = [jwtAuthGuard({ secret: SECRET }), requireRole('gm_admin')];
    const { app, didHandlerRun } = await buildApp(guards);
    const token = signHs256({ role: 'super_admin' });

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(didHandlerRun()).toBe(true);
    await app.close();
  });

  it('should return 403 FORBIDDEN when the role is not permitted', async () => {
    const guards = [jwtAuthGuard({ secret: SECRET }), requireRole('gm_admin')];
    const { app, didHandlerRun } = await buildApp(guards);
    const token = signHs256({ role: 'staff' });

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(didHandlerRun()).toBe(false);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('FORBIDDEN');
    await app.close();
  });

  it('should return 401 when requireRole runs without prior jwtAuthGuard (defensive)', async () => {
    const { app, didHandlerRun } = await buildApp([requireRole('gm_admin')]);

    const res = await app.inject({ method: 'GET', url: '/protected' });

    expect(res.statusCode).toBe(401);
    expect(didHandlerRun()).toBe(false);
    await app.close();
  });
});
