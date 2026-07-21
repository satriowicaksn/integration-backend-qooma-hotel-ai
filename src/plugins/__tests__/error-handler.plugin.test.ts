import { describe, it, expect } from '@jest/globals';
import Fastify, { type FastifyInstance } from 'fastify';

import {
  NotFoundError,
  OutboundQuotaError,
  WaConfigInvalidError,
} from '@core/errors/app-errors.js';

import { registerErrorHandler } from '../error-handler.plugin.js';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  registerErrorHandler(app);
  app.get('/wa-config', () => {
    throw new WaConfigInvalidError('missing phone_number_id', { field: 'phone_number_id' });
  });
  app.get('/quota', () => {
    throw new OutboundQuotaError('outbound top-up balance exhausted');
  });
  app.get('/notfound', () => {
    throw new NotFoundError('hotel', 'acme');
  });
  app.get('/boom', () => {
    throw new Error('super secret internal detail');
  });
  await app.ready();
  return app;
}

describe('registerErrorHandler', () => {
  it('should map an AppError to its status and the canonical envelope', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/wa-config' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({
      error: {
        code: 'WA_CONFIG_INVALID',
        message: 'missing phone_number_id',
        details: { field: 'phone_number_id' },
      },
    });
    await app.close();
  });

  it('should map OutboundQuotaError to 429 RATE_LIMIT', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/quota' });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({
      error: { code: 'RATE_LIMIT', message: 'outbound top-up balance exhausted', details: {} },
    });
    await app.close();
  });

  it('should map an existing hierarchy error (NotFoundError) to 404', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/notfound' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'hotel not found: acme',
        details: { resource: 'hotel', id: 'acme' },
      },
    });
    await app.close();
  });

  it('should map a non-AppError to a safe 500 without leaking internals', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: {
        code: 'INTERNAL',
        message: 'Internal server error',
        details: { correlationId: expect.any(String) },
      },
    });
    expect(res.body).not.toContain('super secret internal detail');
    await app.close();
  });
});
