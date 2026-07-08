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

import { ChannelHealthRepository } from '@modules/channel-health/channel-health.repository.js';
import { ChannelHealthReadAdapter } from '@modules/integration-overview/adapters/channel-health-read.adapter.js';
import { QrStateReadAdapter } from '@modules/integration-overview/adapters/qr-state-read.adapter.js';
import { TelegramConfigReadAdapter } from '@modules/integration-overview/adapters/telegram-config-read.adapter.js';
import { WhatsappConfigReadAdapter } from '@modules/integration-overview/adapters/whatsapp-config-read.adapter.js';
import { integrationOverviewRoutes } from '@modules/integration-overview/integration-overview.routes.js';
import { IntegrationOverviewService } from '@modules/integration-overview/integration-overview.service.js';
import { QrStateRepository } from '@modules/qr-provisioning/qr-provisioning.repository.js';
import { TelegramConfigRepository } from '@modules/telegram/telegram.repository.js';
import { telegramRoutes } from '@modules/telegram/telegram.routes.js';
import { TelegramConfigService } from '@modules/telegram/telegram.service.js';
import { WhatsappConfigRepository } from '@modules/whatsapp/whatsapp-config.repository.js';
import { registerErrorHandler } from '@plugins/error-handler.plugin.js';
import { jwtAuthGuard, requireRole } from '@plugins/jwt-auth.plugin.js';

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

  // T23-followup: aggregated integration overview (spec §2.1 row 27).
  // 4 reader-port adapters bridge to each subsystem's repository; the
  // service composes them via Promise.allSettled with per-subsystem
  // resilience (T23 primitive bindings #9-#11).
  const waRepo = new WhatsappConfigRepository(db);
  const qrRepo = new QrStateRepository(db);
  const healthRepo = new ChannelHealthRepository(db);
  const overviewService = new IntegrationOverviewService(
    {
      whatsapp: new WhatsappConfigReadAdapter(waRepo),
      telegram: new TelegramConfigReadAdapter(telegramRepo),
      qr: new QrStateReadAdapter(qrRepo),
      health: new ChannelHealthReadAdapter(healthRepo),
    },
    logger,
  );
  await app.register(integrationOverviewRoutes, {
    service: overviewService,
    guards: gmAdminGuards,
  });

  return app;
}

export async function shutdownServer(app: FastifyInstance): Promise<void> {
  await app.close();
  await db.$disconnect();
}
