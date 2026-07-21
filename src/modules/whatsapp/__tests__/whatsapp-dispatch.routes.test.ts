// Route-level unit test for T28 /internal/wa/dispatch. Uses fastify.inject
// with fully-mocked dispatch + conversations services.
//
// Verifies:
//  - guard order (401 propagates from injected fake internal-RPC guard)
//  - 400 VALIDATION_ERROR on zod fail (schema tests own the shape; here
//    we prove the route surfaces the error via the canonical envelope)
//  - 404 NotFoundError surfaces as canonical envelope when the dispatch
//    service throws (no WA config)
//  - happy `dispatched` outcome triggers conversations.upsertOnOutbound
//    with status='sent' and the externalMessageId
//  - `meta_failed` outcome ALSO triggers conversations.upsertOnOutbound
//    with status='failed'
//  - `rejected_dnd` / `quota_exhausted` DO NOT touch conversations
//  - conversations.upsertOnOutbound failure is logged, not surfaced

import { describe, expect, it, jest } from '@jest/globals';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

import { AuthError, NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { registerErrorHandler } from '@plugins/error-handler.plugin.js';

import type { WhatsappConversationsService } from '../whatsapp-conversations.service.js';
import { whatsappDispatchRoutes } from '../whatsapp-dispatch.routes.js';
import type { WhatsappOutboundDispatchService } from '../whatsapp-outbound-dispatch.service.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const GUEST_ID = '22222222-3333-4444-5555-666666666666';
const DISPATCH_ID = '33333333-4444-5555-6666-777777777777';
const EXTERNAL_MESSAGE_ID = 'wamid.EXT';

const validPayload = {
  hotel_id: HOTEL_ID,
  guest_id: GUEST_ID,
  to_wa_phone: '+6281234567890',
  body: 'hello world',
};

interface DispatchDouble {
  dispatchMessage: jest.Mock;
}
interface ConversationsDouble {
  upsertOnOutbound: jest.Mock;
}

function createLogger(): Logger & {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
} {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

async function buildTestApp(opts: {
  dispatchDouble: DispatchDouble;
  conversationsDouble: ConversationsDouble;
  logger: ReturnType<typeof createLogger>;
  guardRejects?: boolean;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  const guard = (_req: FastifyRequest, _reply: unknown, done: (err?: Error) => void): void => {
    if (opts.guardRejects === true) {
      done(new AuthError('bad secret'));
      return;
    }
    done();
  };
  await app.register(whatsappDispatchRoutes, {
    dispatchService: opts.dispatchDouble as unknown as WhatsappOutboundDispatchService,
    conversationsService: opts.conversationsDouble as unknown as WhatsappConversationsService,
    guards: [guard],
    logger: opts.logger,
  });
  await app.ready();
  return app;
}

describe('POST /internal/wa/dispatch — guard + validation', () => {
  it('should return 401 canonical envelope when the guard throws AuthError', async () => {
    const dispatchDouble: DispatchDouble = { dispatchMessage: jest.fn() };
    const conversationsDouble: ConversationsDouble = { upsertOnOutbound: jest.fn() };
    const app = await buildTestApp({
      dispatchDouble,
      conversationsDouble,
      logger: createLogger(),
      guardRejects: true,
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/wa/dispatch',
        payload: validPayload,
      });
      expect(res.statusCode).toBe(401);
      expect(dispatchDouble.dispatchMessage).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should return 400 VALIDATION_ERROR when the payload fails zod strict', async () => {
    const dispatchDouble: DispatchDouble = { dispatchMessage: jest.fn() };
    const conversationsDouble: ConversationsDouble = { upsertOnOutbound: jest.fn() };
    const app = await buildTestApp({
      dispatchDouble,
      conversationsDouble,
      logger: createLogger(),
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/wa/dispatch',
        payload: { hotel_id: 'not-uuid' },
      });
      expect(res.statusCode).toBe(400);
      expect(dispatchDouble.dispatchMessage).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should surface NotFoundError from the dispatch service as a 404 canonical envelope', async () => {
    const dispatchDouble: DispatchDouble = {
      dispatchMessage: jest.fn(() => Promise.reject(new NotFoundError('wa_config', HOTEL_ID))),
    };
    const conversationsDouble: ConversationsDouble = { upsertOnOutbound: jest.fn() };
    const app = await buildTestApp({
      dispatchDouble,
      conversationsDouble,
      logger: createLogger(),
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/wa/dispatch',
        payload: validPayload,
      });
      expect(res.statusCode).toBe(404);
      const body = res.json<{ error: { code: string } }>();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(conversationsDouble.upsertOnOutbound).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

describe('POST /internal/wa/dispatch — outcome mapping', () => {
  it('should return 200 with kind=dispatched and upsert the outbound message with status=sent', async () => {
    const dispatchDouble: DispatchDouble = {
      dispatchMessage: jest.fn(() =>
        Promise.resolve({
          kind: 'dispatched' as const,
          dispatchId: DISPATCH_ID,
          externalId: EXTERNAL_MESSAGE_ID,
        }),
      ),
    };
    const conversationsDouble: ConversationsDouble = {
      upsertOnOutbound: jest.fn(() =>
        Promise.resolve({
          conversation: { id: 'conv-1' },
          message: { id: 'msg-1' },
        }),
      ),
    };
    const app = await buildTestApp({
      dispatchDouble,
      conversationsDouble,
      logger: createLogger(),
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/wa/dispatch',
        payload: validPayload,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ kind: string; dispatch_id: string; external_message_id: string }>();
      expect(body.kind).toBe('dispatched');
      expect(body.dispatch_id).toBe(DISPATCH_ID);
      expect(body.external_message_id).toBe(EXTERNAL_MESSAGE_ID);
      expect(conversationsDouble.upsertOnOutbound).toHaveBeenCalledTimes(1);
      const upsertArg = conversationsDouble.upsertOnOutbound.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(upsertArg['status']).toBe('sent');
      expect(upsertArg['dispatchId']).toBe(DISPATCH_ID);
      expect(upsertArg['externalMessageId']).toBe(EXTERNAL_MESSAGE_ID);
      expect(upsertArg['body']).toBe('hello world');
    } finally {
      await app.close();
    }
  });

  it('should return 200 with kind=meta_failed and upsert the outbound message with status=failed', async () => {
    const dispatchDouble: DispatchDouble = {
      dispatchMessage: jest.fn(() =>
        Promise.resolve({
          kind: 'meta_failed' as const,
          dispatchId: DISPATCH_ID,
          status: 502,
        }),
      ),
    };
    const conversationsDouble: ConversationsDouble = {
      upsertOnOutbound: jest.fn(() => Promise.resolve({ conversation: {}, message: {} })),
    };
    const app = await buildTestApp({
      dispatchDouble,
      conversationsDouble,
      logger: createLogger(),
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/wa/dispatch',
        payload: validPayload,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ kind: string; dispatch_id: string; status: number }>();
      expect(body.kind).toBe('meta_failed');
      expect(body.status).toBe(502);
      expect(conversationsDouble.upsertOnOutbound).toHaveBeenCalledTimes(1);
      const upsertArg = conversationsDouble.upsertOnOutbound.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(upsertArg['status']).toBe('failed');
      expect(upsertArg['externalMessageId']).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('should return 200 with kind=rejected_dnd and NOT touch conversations (no send happened)', async () => {
    const dispatchDouble: DispatchDouble = {
      dispatchMessage: jest.fn(() =>
        Promise.resolve({ kind: 'rejected_dnd' as const, reason: 'dnd_window_active' }),
      ),
    };
    const conversationsDouble: ConversationsDouble = { upsertOnOutbound: jest.fn() };
    const app = await buildTestApp({
      dispatchDouble,
      conversationsDouble,
      logger: createLogger(),
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/wa/dispatch',
        payload: validPayload,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ kind: string; reason: string }>();
      expect(body.kind).toBe('rejected_dnd');
      expect(body.reason).toBe('dnd_window_active');
      expect(conversationsDouble.upsertOnOutbound).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should return 200 with kind=quota_exhausted and NOT touch conversations', async () => {
    const dispatchDouble: DispatchDouble = {
      dispatchMessage: jest.fn(() =>
        Promise.resolve({ kind: 'quota_exhausted' as const, reason: 'topup_balance_exhausted' }),
      ),
    };
    const conversationsDouble: ConversationsDouble = { upsertOnOutbound: jest.fn() };
    const app = await buildTestApp({
      dispatchDouble,
      conversationsDouble,
      logger: createLogger(),
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/wa/dispatch',
        payload: validPayload,
      });
      expect(res.statusCode).toBe(200);
      expect(conversationsDouble.upsertOnOutbound).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should log an error but STILL return the dispatch outcome when conversations.upsertOnOutbound throws (binding GAP T28-#1)', async () => {
    const dispatchDouble: DispatchDouble = {
      dispatchMessage: jest.fn(() =>
        Promise.resolve({
          kind: 'dispatched' as const,
          dispatchId: DISPATCH_ID,
          externalId: EXTERNAL_MESSAGE_ID,
        }),
      ),
    };
    const conversationsDouble: ConversationsDouble = {
      upsertOnOutbound: jest.fn(() => Promise.reject(new Error('conversations upsert exploded'))),
    };
    const logger = createLogger();
    const app = await buildTestApp({ dispatchDouble, conversationsDouble, logger });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/wa/dispatch',
        payload: validPayload,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ kind: string; dispatch_id: string }>();
      expect(body.kind).toBe('dispatched');
      expect(body.dispatch_id).toBe(DISPATCH_ID);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'whatsapp_dispatch.messages_upsert_failed' }),
      );
    } finally {
      await app.close();
    }
  });
});
