// Route-level unit test using fastify.inject against fully-mocked ports.
// Exercises PM C ACK T19-followup bindings #6 (persist BEFORE dispatch) +
// #7 (200 { ok } even when dispatch throws) + #8 (guard chain order) —
// without requiring a real Postgres. The integration test suite covers
// the DB-persist round-trip separately.

import { describe, expect, it, jest } from '@jest/globals';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

import { AuthError, NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { registerErrorHandler } from '@plugins/error-handler.plugin.js';

import { telegramInboundRoutes } from '../telegram-inbound.routes.js';
import type { TelegramInboundService } from '../telegram-inbound.service.js';
import type { TelegramWebhookEventsRepository } from '../telegram-webhook-events.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

interface LoggerMock extends Logger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

function buildLogger(): LoggerMock {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

async function buildTestApp(opts: {
  service: TelegramInboundService;
  repo: TelegramWebhookEventsRepository;
  logger: LoggerMock;
  order: string[];
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  const tenantResolver = (req: FastifyRequest): Promise<void> => {
    (req as { hotelId?: string }).hotelId = HOTEL_ID;
    opts.order.push('tenant');
    return Promise.resolve();
  };
  const signatureGuard = (_req: FastifyRequest): Promise<void> => {
    opts.order.push('signature');
    return Promise.resolve();
  };

  await app.register(telegramInboundRoutes, {
    service: opts.service,
    repo: opts.repo,
    tenantResolver,
    signatureGuard,
    logger: opts.logger,
  });
  await app.ready();
  return app;
}

const VALID_UPDATE = {
  update_id: 42,
  message: {
    message_id: 1,
    date: 1_720_000_000,
    chat: { id: 100 },
    from: { id: 123_456_789 },
    text: '/help',
  },
};

describe('telegramInboundRoutes — guard order + persist/dispatch discipline', () => {
  it('should run tenant resolver BEFORE signature guard BEFORE persist BEFORE dispatch (binding #6/#8)', async () => {
    const order: string[] = [];
    const repo = {
      persist: jest.fn(() => {
        order.push('persist');
        return Promise.resolve({ id: 'evt-1', receivedAt: new Date() });
      }),
    };
    const service = {
      handleUpdate: jest.fn(() => {
        order.push('dispatch');
        return Promise.resolve({ kind: 'ignored', reason: 'no_message' } as const);
      }),
    };
    const logger = buildLogger();

    const app = await buildTestApp({
      service: service as unknown as TelegramInboundService,
      repo: repo as unknown as TelegramWebhookEventsRepository,
      logger,
      order,
    });

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/webhook/telegram/any',
        payload: VALID_UPDATE,
      });
      expect(res.statusCode).toBe(200);
      expect(order).toEqual(['tenant', 'signature', 'persist', 'dispatch']);
    } finally {
      await app.close();
    }
  });

  it('should still return 200 { ok: true } and log the error when dispatch throws (binding #7)', async () => {
    const order: string[] = [];
    const repo = {
      persist: jest.fn(() => {
        order.push('persist');
        return Promise.resolve({ id: 'evt-2', receivedAt: new Date() });
      }),
    };
    const service = {
      handleUpdate: jest.fn(() => {
        order.push('dispatch');
        return Promise.reject(new Error('downstream boom'));
      }),
    };
    const logger = buildLogger();

    const app = await buildTestApp({
      service: service as unknown as TelegramInboundService,
      repo: repo as unknown as TelegramWebhookEventsRepository,
      logger,
      order,
    });

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/webhook/telegram/any',
        payload: VALID_UPDATE,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      // Persist must have happened BEFORE the throwing dispatch.
      expect(order).toEqual(['tenant', 'signature', 'persist', 'dispatch']);
      // Error was logged, not surfaced.
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'telegram_inbound.dispatch_failed',
        }),
      );
    } finally {
      await app.close();
    }
  });

  it('should return 400 (VALIDATION_ERROR) when the body fails zod parse, and NOT persist', async () => {
    const order: string[] = [];
    const repo = {
      persist: jest.fn(() => Promise.resolve({ id: 'x', receivedAt: new Date() })),
    };
    const service = {
      handleUpdate: jest.fn(() =>
        Promise.resolve({ kind: 'ignored', reason: 'no_message' } as const),
      ),
    };
    const logger = buildLogger();

    const app = await buildTestApp({
      service: service as unknown as TelegramInboundService,
      repo: repo as unknown as TelegramWebhookEventsRepository,
      logger,
      order,
    });

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/webhook/telegram/any',
        payload: { not: 'a telegram update' },
      });
      expect(res.statusCode).toBe(400);
      expect(repo.persist).not.toHaveBeenCalled();
      expect(service.handleUpdate).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should surface tenantResolver rejection as a 404 canonical envelope and NOT persist', async () => {
    const order: string[] = [];
    const repo = {
      persist: jest.fn(() => Promise.resolve({ id: 'x', receivedAt: new Date() })),
    };
    const service = {
      handleUpdate: jest.fn(() =>
        Promise.resolve({ kind: 'ignored', reason: 'no_message' } as const),
      ),
    };
    const logger = buildLogger();
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    await app.register(telegramInboundRoutes, {
      service: service as unknown as TelegramInboundService,
      repo: repo as unknown as TelegramWebhookEventsRepository,
      tenantResolver: () => Promise.reject(new NotFoundError('hotel', 'x')),
      signatureGuard: () => {
        order.push('signature');
        return Promise.resolve();
      },
      logger,
    });
    await app.ready();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/webhook/telegram/any',
        payload: VALID_UPDATE,
      });
      expect(res.statusCode).toBe(404);
      expect(order).toEqual([]);
      expect(repo.persist).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should surface signatureGuard rejection as a 401 canonical envelope and NOT persist', async () => {
    const order: string[] = [];
    const repo = {
      persist: jest.fn(() => Promise.resolve({ id: 'x', receivedAt: new Date() })),
    };
    const service = {
      handleUpdate: jest.fn(() =>
        Promise.resolve({ kind: 'ignored', reason: 'no_message' } as const),
      ),
    };
    const logger = buildLogger();
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    await app.register(telegramInboundRoutes, {
      service: service as unknown as TelegramInboundService,
      repo: repo as unknown as TelegramWebhookEventsRepository,
      tenantResolver: (req: FastifyRequest) => {
        (req as { hotelId?: string }).hotelId = HOTEL_ID;
        order.push('tenant');
        return Promise.resolve();
      },
      signatureGuard: () => Promise.reject(new AuthError('bad sig')),
      logger,
    });
    await app.ready();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/webhook/telegram/any',
        payload: VALID_UPDATE,
      });
      expect(res.statusCode).toBe(401);
      expect(order).toEqual(['tenant']);
      expect(repo.persist).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should return 400 when tenantResolver returns without setting req.hotelId (defensive branch)', async () => {
    const repo = {
      persist: jest.fn(() => Promise.resolve({ id: 'x', receivedAt: new Date() })),
    };
    const service = {
      handleUpdate: jest.fn(() =>
        Promise.resolve({ kind: 'ignored', reason: 'no_message' } as const),
      ),
    };
    const logger = buildLogger();
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    await app.register(telegramInboundRoutes, {
      service: service as unknown as TelegramInboundService,
      repo: repo as unknown as TelegramWebhookEventsRepository,
      tenantResolver: () => Promise.resolve(),
      signatureGuard: () => Promise.resolve(),
      logger,
    });
    await app.ready();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/webhook/telegram/any',
        payload: VALID_UPDATE,
      });
      expect(res.statusCode).toBe(400);
      expect(repo.persist).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should NEVER surface the Bot API secret token header in a logger call (binding #5 contract check)', async () => {
    // The route handler does NOT read req.headers into any logger.*
    // call. This test injects a request with the sensitive header and
    // asserts none of the logger calls JSON.stringify includes it.
    const secretHeaderValue = '987654321:AABBccDDEEffGGhh';
    const order: string[] = [];
    const repo = {
      persist: jest.fn(() => Promise.resolve({ id: 'x', receivedAt: new Date() })),
    };
    const service = {
      handleUpdate: jest.fn(() =>
        Promise.reject(new Error('force error path so logger.error is exercised')),
      ),
    };
    const logger = buildLogger();

    const app = await buildTestApp({
      service: service as unknown as TelegramInboundService,
      repo: repo as unknown as TelegramWebhookEventsRepository,
      logger,
      order,
    });

    try {
      await app.inject({
        method: 'POST',
        url: '/webhook/telegram/any',
        headers: {
          'x-telegram-bot-api-secret-token': secretHeaderValue,
        },
        payload: VALID_UPDATE,
      });
      // Neither warn/info/error/debug should include the header value.
      for (const method of ['info', 'warn', 'error', 'debug'] as const) {
        for (const call of logger[method].mock.calls) {
          const payload = call[0];
          expect(JSON.stringify(payload)).not.toContain(secretHeaderValue);
        }
      }
    } finally {
      await app.close();
    }
  });
});
