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

import { TelegramConfigRepository } from '@modules/telegram/telegram.repository.js';
import { telegramRoutes } from '@modules/telegram/telegram.routes.js';
import { TelegramConfigService } from '@modules/telegram/telegram.service.js';
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

  return app;
}

export async function shutdownServer(app: FastifyInstance): Promise<void> {
  await app.close();
  await db.$disconnect();
}
