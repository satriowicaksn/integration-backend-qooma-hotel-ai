import { describe, it, expect } from '@jest/globals';
import Fastify, { type FastifyInstance } from 'fastify';

import { internalRpcAuthGuard, verifyInternalSecret } from '../internal-rpc-auth.plugin.js';

const SECRET = 'super-secret-internal-token';

interface Harness {
  app: FastifyInstance;
  didHandlerRun: () => boolean;
}

async function buildApp(secret = SECRET): Promise<Harness> {
  let handlerRan = false;
  const app = Fastify();
  app.post('/rpc/send_wa_message', { preHandler: internalRpcAuthGuard({ secret }) }, () => {
    handlerRan = true;
    return { ok: true };
  });
  await app.ready();
  return { app, didHandlerRun: () => handlerRan };
}

describe('verifyInternalSecret (pure)', () => {
  it('should return true when the provided secret matches', () => {
    expect(verifyInternalSecret(SECRET, SECRET)).toBe(true);
  });

  it('should return false when the secret is wrong', () => {
    expect(verifyInternalSecret('nope', SECRET)).toBe(false);
  });

  it('should return false without throwing when lengths differ', () => {
    expect(verifyInternalSecret('short', SECRET)).toBe(false);
  });

  it('should return false when no secret is provided', () => {
    expect(verifyInternalSecret(undefined, SECRET)).toBe(false);
  });

  it('should never authenticate against a blank configured secret', () => {
    expect(verifyInternalSecret('', '')).toBe(false);
    expect(verifyInternalSecret('anything', '')).toBe(false);
  });
});

describe('internalRpcAuthGuard (fastify.inject)', () => {
  it('should return 200 and run the handler with a valid secret', async () => {
    const { app, didHandlerRun } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rpc/send_wa_message',
      headers: { 'content-type': 'application/json', 'x-internal-secret': SECRET },
      payload: { hotel_id: 'h1', body: 'hi' },
    });
    expect(res.statusCode).toBe(200);
    expect(didHandlerRun()).toBe(true);
    await app.close();
  });

  it('should return 401 and skip the handler with a wrong secret', async () => {
    const { app, didHandlerRun } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rpc/send_wa_message',
      headers: { 'x-internal-secret': 'wrong' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(didHandlerRun()).toBe(false);
    await app.close();
  });

  it('should return 401 and skip the handler when the header is missing', async () => {
    const { app, didHandlerRun } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rpc/send_wa_message',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(didHandlerRun()).toBe(false);
    await app.close();
  });
});
