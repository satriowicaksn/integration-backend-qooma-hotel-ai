/**
 * API server factory — no side effects on import.
 *
 * The Fastify instance is assembled here so both the runtime entrypoint
 * (`api.ts`) and integration tests (`*.integration.test.ts`) can share
 * the exact same wiring without accidentally triggering
 * `app.listen()` / signal handlers when the module is imported.
 *
 * Route registrations grow one primitive at a time (T##-followup PRs).
 * Current: T17 telegram config CRUD.
 * Pending: T19 webhook, T20 RPC, T22 QR, T23 overview, T24 health GET.
 */

import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyInstance } from 'fastify';

import { loadConfig } from '@core/config/env.js';
import { createLogger } from '@core/logger/logger.js';
import { db } from '@core/prisma/prisma-client.js';

import { EnvHotelSlugLookup } from '@modules/telegram/adapters/hotel-slug-lookup.adapter.js';
import { StaffLookupStubAdapter } from '@modules/telegram/adapters/staff-lookup-stub.adapter.js';
import { TelegramWebhookSecretResolver } from '@modules/telegram/adapters/telegram-webhook-secret.adapter.js';
import { TicketActionStubAdapter } from '@modules/telegram/adapters/ticket-action-stub.adapter.js';
import { telegramInboundRoutes } from '@modules/telegram/telegram-inbound.routes.js';
import { TelegramInboundService } from '@modules/telegram/telegram-inbound.service.js';
import { TelegramWebhookEventsRepository } from '@modules/telegram/telegram-webhook-events.repository.js';
import { TelegramConfigRepository } from '@modules/telegram/telegram.repository.js';
import { telegramRoutes } from '@modules/telegram/telegram.routes.js';
import { TelegramConfigService } from '@modules/telegram/telegram.service.js';
import { DepartmentTelegramReadStubAdapter } from '@modules/telegram-dept-routing/adapters/department-telegram-read-stub.adapter.js';
import { DepartmentTelegramWriteStubAdapter } from '@modules/telegram-dept-routing/adapters/department-telegram-write-stub.adapter.js';
import { telegramDeptRoutingRoutes } from '@modules/telegram-dept-routing/telegram-dept-routing.routes.js';
import { TelegramDeptRoutingService } from '@modules/telegram-dept-routing/telegram-dept-routing.service.js';
import { registerErrorHandler } from '@plugins/error-handler.plugin.js';
import { registerWebhookRawBody, verifyWebhookSignature } from '@plugins/hmac-validator.plugin.js';
import { jwtAuthGuard, requireRole } from '@plugins/jwt-auth.plugin.js';
import { createSlugResolver, resolveTenantFromSlug } from '@plugins/tenant-resolver.plugin.js';

const CORRELATION_HEADER = 'x-correlation-id';

export async function buildServer(): Promise<FastifyInstance> {
  const config = loadConfig();

  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    genReqId: (req) => {
      const header = req.headers[CORRELATION_HEADER];
      const inbound = Array.isArray(header) ? header[0] : header;
      return inbound ?? randomUUID();
    },
    trustProxy: true,
  });

  app.addHook('onSend', (req, reply, _payload, done) => {
    void reply.header(CORRELATION_HEADER, req.id);
    done();
  });

  registerErrorHandler(app);

  app.setNotFoundHandler((req, reply) => {
    void reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method}:${req.url} not found`,
        details: {},
      },
    });
  });

  app.get('/healthz', () => ({ status: 'ok' }));

  // Manual DI wiring: repository ← db, service ← repo + logger.
  // Guards composed here so route plugins stay auth-agnostic.
  const logger = createLogger({ service: 'api', level: config.LOG_LEVEL });
  const gmAdminGuards = [
    jwtAuthGuard({ secret: config.JWT_ACCESS_SECRET }),
    requireRole('gm_admin'),
  ];

  const telegramRepo = new TelegramConfigRepository(db);
  const telegramService = new TelegramConfigService(telegramRepo, logger);
  await app.register(telegramRoutes, {
    service: telegramService,
    guards: gmAdminGuards,
  });

  // T19-followup: Telegram inbound webhook (spec §2.3 + §3.2 + §4.6-4.7).
  // Raw-body parser + tenant resolver + signature guard compose in order.
  // HC RPC adapters ship as stubs pending Q-C-06 + Q-C-07 (PLAN GAP #1).
  registerWebhookRawBody(app);
  const webhookRepo = new TelegramWebhookEventsRepository(db);
  const secretResolver = new TelegramWebhookSecretResolver(telegramRepo);
  const slugAdapter = new EnvHotelSlugLookup(config.TELEGRAM_WEBHOOK_HOTEL_SLUG_MAP ?? '');
  const slugResolver = createSlugResolver({ lookup: (slug) => slugAdapter.lookup(slug) });
  const inboundService = new TelegramInboundService(
    new StaffLookupStubAdapter(logger),
    new TicketActionStubAdapter(logger),
    logger,
  );
  await app.register(telegramInboundRoutes, {
    service: inboundService,
    repo: webhookRepo,
    tenantResolver: resolveTenantFromSlug({ resolver: slugResolver }),
    signatureGuard: verifyWebhookSignature({
      provider: 'telegram',
      resolveSecret: (req) =>
        secretResolver.resolveSecret({ hotelId: requireHotelIdForSecret(req.hotelId) }),
    }),
    logger,
  });

  // T18-followup: Per-dept Telegram routing write-through (spec §2.1 row 30).
  // HC read/write adapters ship as stubs pending Q-OPS-06 + Q-CONTRACT-25
  // (PLAN GAP #1). Env `TELEGRAM_DEPT_ROUTING_MAP` seeds the dept→hotel
  // lookup; the write stub NEVER touches HC's `departments` table.
  const deptReadStub = new DepartmentTelegramReadStubAdapter(
    config.TELEGRAM_DEPT_ROUTING_MAP ?? '',
  );
  const deptWriteStub = new DepartmentTelegramWriteStubAdapter(logger);
  const deptRoutingService = new TelegramDeptRoutingService(
    { deptRead: deptReadStub, deptWrite: deptWriteStub },
    logger,
  );
  await app.register(telegramDeptRoutingRoutes, {
    service: deptRoutingService,
    guards: gmAdminGuards,
  });

  // Loud startup signal: this deployment carries stubbed HC adapters.
  // Ops should see this on every boot until Q-OPS-06 + Q-CONTRACT-25 land.
  logger.warn({
    msg: 'telegram_dept_routing.startup',
    module: 'telegram-dept-routing',
    hcAdapters: 'STUB',
    ratifyQs: 'Q-OPS-06,Q-CONTRACT-25',
  });

  return app;
}

function requireHotelIdForSecret(candidate: string | undefined): string {
  if (candidate === undefined || candidate === '') {
    throw new Error('hotelId must be resolved before signature verification');
  }
  return candidate;
}

export async function shutdownServer(app: FastifyInstance): Promise<void> {
  await app.close();
  await db.$disconnect();
}
