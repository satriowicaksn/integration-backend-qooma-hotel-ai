// Route-level unit test for T27 POST /webhook/whatsapp/:hotel_slug.
// Uses fastify.inject with fully-mocked ingest + conversations services
// and fake tenant/signature guards. Exercises PM T27 CRITICAL bindings:
//   #8/#13 guard ORDER (tenant → sig → persist → dispatch)
//   #7    200 { ok: true } even when downstream dispatch throws
//   PII floor on sig-header value + body

import { describe, expect, it, jest } from '@jest/globals';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

import { AuthError, NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { registerErrorHandler } from '@plugins/error-handler.plugin.js';

import type { WhatsappConversationsService } from '../whatsapp-conversations.service.js';
import type { WhatsappInboundIngestService } from '../whatsapp-inbound-ingest.service.js';
import { whatsappWebhookRoutes } from '../whatsapp-webhook.routes.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const EVENT_ID = 'dddddddd-eeee-ffff-0000-111111111111';

interface IngestDouble {
  ingestSync: jest.Mock;
  processEvent: jest.Mock;
}
interface ConversationsDouble {
  upsertOnInbound: jest.Mock;
}

function buildLogger(): Logger & {
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

async function buildApp(opts: {
  ingestDouble: IngestDouble;
  conversationsDouble: ConversationsDouble;
  logger: ReturnType<typeof buildLogger>;
  order: string[];
  tenantRejects?: NotFoundError | undefined;
  signatureRejects?: AuthError | undefined;
  omitHotelId?: boolean;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  const tenantResolver = (req: FastifyRequest): Promise<void> => {
    if (opts.tenantRejects !== undefined) return Promise.reject(opts.tenantRejects);
    if (!opts.omitHotelId) {
      (req as { hotelId?: string }).hotelId = HOTEL_ID;
    }
    opts.order.push('tenant');
    return Promise.resolve();
  };
  const signatureGuard = (_req: FastifyRequest): Promise<void> => {
    if (opts.signatureRejects !== undefined) return Promise.reject(opts.signatureRejects);
    opts.order.push('signature');
    return Promise.resolve();
  };

  await app.register(whatsappWebhookRoutes, {
    ingestService: opts.ingestDouble as unknown as WhatsappInboundIngestService,
    conversationsService: opts.conversationsDouble as unknown as WhatsappConversationsService,
    tenantResolver,
    signatureGuard,
    logger: opts.logger,
  });
  await app.ready();
  return app;
}

const VALID_ENVELOPE = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'entry-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '+62999', phone_number_id: 'pnid' },
            messages: [
              {
                id: 'wamid.HBg',
                from: '+6281234567890',
                timestamp: '1720000000',
                type: 'text',
                text: { body: 'hi' },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('POST /webhook/whatsapp/:hotel_slug — guard order + persist/dispatch discipline', () => {
  it('should run tenant → signature → persist → per-message dispatch in that order (bindings #8/#13)', async () => {
    const order: string[] = [];
    const ingest: IngestDouble = {
      ingestSync: jest.fn(() => {
        order.push('persist');
        return Promise.resolve({ eventId: EVENT_ID, isDuplicate: false });
      }),
      processEvent: jest.fn(() => {
        order.push('dispatch');
        return Promise.resolve([]);
      }),
    };
    const conversationsDouble: ConversationsDouble = {
      upsertOnInbound: jest.fn(() => {
        order.push('upsert');
        return Promise.resolve({ conversation: {}, message: {} });
      }),
    };
    const logger = buildLogger();
    const app = await buildApp({ ingestDouble: ingest, conversationsDouble, logger, order });

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp/any',
        payload: VALID_ENVELOPE,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      expect(order).toEqual(['tenant', 'signature', 'persist', 'upsert', 'dispatch']);
    } finally {
      await app.close();
    }
  });

  it('should return 200 { ok: true } and log an error when the dispatch orchestrator throws (binding #7)', async () => {
    const order: string[] = [];
    const ingest: IngestDouble = {
      ingestSync: jest.fn(() => {
        order.push('persist');
        return Promise.resolve({ eventId: EVENT_ID, isDuplicate: false });
      }),
      processEvent: jest.fn(() => Promise.reject(new Error('downstream boom'))),
    };
    const conversationsDouble: ConversationsDouble = {
      upsertOnInbound: jest.fn(() => Promise.resolve({ conversation: {}, message: {} })),
    };
    const logger = buildLogger();
    const app = await buildApp({ ingestDouble: ingest, conversationsDouble, logger, order });

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp/any',
        payload: VALID_ENVELOPE,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      expect(order).toContain('persist');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'whatsapp_inbound.dispatch_failed' }),
      );
    } finally {
      await app.close();
    }
  });

  it('should surface tenant resolver rejection as a 404 canonical envelope and NOT persist (anti-enum)', async () => {
    const order: string[] = [];
    const ingest: IngestDouble = {
      ingestSync: jest.fn(),
      processEvent: jest.fn(),
    };
    const conversationsDouble: ConversationsDouble = { upsertOnInbound: jest.fn() };
    const app = await buildApp({
      ingestDouble: ingest,
      conversationsDouble,
      logger: buildLogger(),
      order,
      tenantRejects: new NotFoundError('hotel', 'unknown'),
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp/unknown',
        payload: VALID_ENVELOPE,
      });
      expect(res.statusCode).toBe(404);
      expect(ingest.ingestSync).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should surface signature guard rejection as a 401 canonical envelope and NOT persist', async () => {
    const order: string[] = [];
    const ingest: IngestDouble = {
      ingestSync: jest.fn(),
      processEvent: jest.fn(),
    };
    const conversationsDouble: ConversationsDouble = { upsertOnInbound: jest.fn() };
    const app = await buildApp({
      ingestDouble: ingest,
      conversationsDouble,
      logger: buildLogger(),
      order,
      signatureRejects: new AuthError('bad sig'),
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp/any',
        payload: VALID_ENVELOPE,
      });
      expect(res.statusCode).toBe(401);
      expect(order).toEqual(['tenant']);
      expect(ingest.ingestSync).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should return 400 when the tenant resolver returns without setting req.hotelId (defensive)', async () => {
    const order: string[] = [];
    const ingest: IngestDouble = {
      ingestSync: jest.fn(),
      processEvent: jest.fn(),
    };
    const conversationsDouble: ConversationsDouble = { upsertOnInbound: jest.fn() };
    const app = await buildApp({
      ingestDouble: ingest,
      conversationsDouble,
      logger: buildLogger(),
      order,
      omitHotelId: true,
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp/any',
        payload: VALID_ENVELOPE,
      });
      expect(res.statusCode).toBe(400);
      expect(ingest.ingestSync).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should NEVER surface the X-Hub-Signature-256 header value in any logger call (binding — sig secret discipline)', async () => {
    const order: string[] = [];
    const signatureValue = 'sha256=deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const ingest: IngestDouble = {
      ingestSync: jest.fn(() => Promise.resolve({ eventId: EVENT_ID, isDuplicate: false })),
      processEvent: jest.fn(() =>
        Promise.reject(new Error('force error path so logger.error runs')),
      ),
    };
    const conversationsDouble: ConversationsDouble = {
      upsertOnInbound: jest.fn(() => Promise.resolve({ conversation: {}, message: {} })),
    };
    const logger = buildLogger();
    const app = await buildApp({ ingestDouble: ingest, conversationsDouble, logger, order });

    try {
      await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp/any',
        headers: { 'x-hub-signature-256': signatureValue },
        payload: VALID_ENVELOPE,
      });
      for (const method of ['info', 'warn', 'error', 'debug'] as const) {
        for (const call of logger[method].mock.calls) {
          expect(JSON.stringify(call[0])).not.toContain(signatureValue);
        }
      }
    } finally {
      await app.close();
    }
  });
});
