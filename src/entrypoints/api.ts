/**
 * Entrypoint: HTTP API server (Fastify) — Q-C-02 resolution.
 *
 * Responsibilities:
 * - Load validated config (`@core/config/env`).
 * - Bring up Fastify with correlation-id support (`x-correlation-id`
 *   round-trip via `genReqId` + `onSend` hook).
 * - Register T08 canonical error-handler plugin (`registerErrorHandler`).
 * - Expose an unauthenticated `/healthz` liveness probe (K8s/orchestrator
 *   convention; deliberately outside `/api/*`).
 * - Graceful shutdown on SIGTERM/SIGINT — closes the server + Prisma
 *   client so in-flight queries + connections drain before exit.
 *
 * Deferred to T##-followup route landings (each primitive's own PR):
 * - Module route mounts (`/api/integrations/telegram`, `/webhook/...`,
 *   internal RPC endpoints, etc.).
 * - Adapter/service manual DI at composition boundary.
 * - JWT `gm_admin` guard plugin (Q-C-03, still open).
 * - HMAC-verify wire for webhook routes (T04 primitive exists;
 *   registered at route landing).
 * - Rate-limit / CORS / helmet plugin registration (all deps installed;
 *   wired when first public route lands).
 */

import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyInstance } from 'fastify';

import { loadConfig } from '@core/config/env.js';
import { db } from '@core/prisma/prisma-client.js';

import { registerErrorHandler } from '@plugins/error-handler.plugin.js';

const CORRELATION_HEADER = 'x-correlation-id';

export function buildServer(): FastifyInstance {
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

  return app;
}

async function shutdown(app: FastifyInstance): Promise<void> {
  await app.close();
  await db.$disconnect();
}

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildServer();

  const handleTerm = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, 'shutting down');
    void shutdown(app)
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        app.log.error({ err }, 'error during shutdown');
        process.exit(1);
      });
  };
  process.on('SIGTERM', handleTerm);
  process.on('SIGINT', handleTerm);

  await app.listen({ port: config.API_PORT, host: config.API_HOST });
  app.log.info({ port: config.API_PORT, host: config.API_HOST }, 'api server listening');
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
