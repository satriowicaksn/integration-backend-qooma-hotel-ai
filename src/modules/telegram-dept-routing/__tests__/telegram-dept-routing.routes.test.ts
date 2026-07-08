// Route-level unit test for T18-followup PUT /api/integrations/telegram/departments/:dept_id.
// Uses fastify.inject with mocked service to exercise 401 / 400 / defensive branches
// without requiring a real Postgres. The integration test suite covers §4.10
// identical-404 shape end-to-end.

import { describe, expect, it, jest } from '@jest/globals';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

import { AuthError, NotFoundError } from '@core/errors/app-errors.js';

import { registerErrorHandler } from '@plugins/error-handler.plugin.js';

import { telegramDeptRoutingRoutes } from '../telegram-dept-routing.routes.js';
import type { TelegramDeptRoutingService } from '../telegram-dept-routing.service.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const DEPT_ID = 'dept-hk-01';
const NOW = new Date('2026-07-08T22:30:00.000Z');

interface ServiceMock {
  updateRouting: jest.Mock<TelegramDeptRoutingService['updateRouting']>;
}

function buildService(): ServiceMock {
  return { updateRouting: jest.fn<TelegramDeptRoutingService['updateRouting']>() };
}

async function buildApp(
  service: ServiceMock,
  opts: { authed?: boolean; hotelId?: string } = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  const guard = (req: FastifyRequest, _reply: unknown, done: (err?: unknown) => void): void => {
    if (opts.authed === false) {
      done(new AuthError('missing token'));
      return;
    }
    (req as { hotelId?: string }).hotelId = opts.hotelId ?? HOTEL_ID;
    done();
  };

  await app.register(telegramDeptRoutingRoutes, {
    service: service as unknown as TelegramDeptRoutingService,
    guards: [guard as never],
  });
  await app.ready();
  return app;
}

describe('telegramDeptRoutingRoutes — PUT /api/integrations/telegram/departments/:dept_id', () => {
  it('should return 401 canonical envelope when the auth guard rejects', async () => {
    const service = buildService();
    const app = await buildApp(service, { authed: false });
    try {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/integrations/telegram/departments/${DEPT_ID}`,
        payload: { telegram_chat_id: '-1001' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json<{ error: { code: string } }>().error.code).toBe('AUTH_ERROR');
      expect(service.updateRouting).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should return 400 canonical envelope on zod validation failure (empty body)', async () => {
    const service = buildService();
    const app = await buildApp(service);
    try {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/integrations/telegram/departments/${DEPT_ID}`,
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
      expect(service.updateRouting).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should return 400 canonical envelope when zod rejects an unknown top-level key (.strict)', async () => {
    const service = buildService();
    const app = await buildApp(service);
    try {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/integrations/telegram/departments/${DEPT_ID}`,
        payload: { telegram_chat_id: '-1001', gm_telegram_id: '999' },
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('should call service.updateRouting with the parsed input and return the wire response on happy path', async () => {
    const service = buildService();
    service.updateRouting.mockResolvedValue({ updated: true, updatedAt: NOW });
    const app = await buildApp(service);
    try {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/integrations/telegram/departments/${DEPT_ID}`,
        payload: { telegram_chat_id: '-1001234567890', supervisor_telegram_id: '987654321' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ updated: boolean; updated_at: string }>()).toEqual({
        updated: true,
        updated_at: NOW.toISOString(),
      });
      expect(service.updateRouting).toHaveBeenCalledWith({
        hotelId: HOTEL_ID,
        deptId: DEPT_ID,
        telegramChatId: '-1001234567890',
        supervisorTelegramId: '987654321',
      });
    } finally {
      await app.close();
    }
  });

  it('should pass through NotFoundError from the service as a 404 canonical envelope (§4.10 identical-shape preserved)', async () => {
    const service = buildService();
    service.updateRouting.mockRejectedValue(new NotFoundError('department', DEPT_ID));
    const app = await buildApp(service);
    try {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/integrations/telegram/departments/${DEPT_ID}`,
        payload: { telegram_chat_id: '-1001' },
      });
      expect(res.statusCode).toBe(404);
      const body = res.json<{
        error: { code: string; details: { resource: string; id: string } };
      }>();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.details.resource).toBe('department');
      expect(body.error.details.id).toBe(DEPT_ID);
    } finally {
      await app.close();
    }
  });

  it('should return 401 when the guard populates without a hotelId (defensive branch)', async () => {
    const service = buildService();
    const app = await buildApp(service, { hotelId: '' });
    try {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/integrations/telegram/departments/${DEPT_ID}`,
        payload: { telegram_chat_id: '-1001' },
      });
      expect(res.statusCode).toBe(401);
      expect(service.updateRouting).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should pass through chat-only or supervisor-only updates without polluting the input', async () => {
    const service = buildService();
    service.updateRouting.mockResolvedValue({ updated: true, updatedAt: NOW });
    const app = await buildApp(service);
    try {
      await app.inject({
        method: 'PUT',
        url: `/api/integrations/telegram/departments/${DEPT_ID}`,
        payload: { telegram_chat_id: '-1001' },
      });
      const call = service.updateRouting.mock.calls[0]?.[0];
      expect(call).toEqual({
        hotelId: HOTEL_ID,
        deptId: DEPT_ID,
        telegramChatId: '-1001',
      });
      expect(call).not.toHaveProperty('supervisorTelegramId');
    } finally {
      await app.close();
    }
  });
});
