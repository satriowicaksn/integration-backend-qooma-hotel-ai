/**
 * Entrypoint: HTTP API server (Fastify) — Q-C-02 resolution.
 *
 * This file is the runtime entry only. All wiring lives in
 * `api-server.ts` so integration tests can share the same server
 * assembly without triggering `main()` on import.
 *
 * Responsibilities:
 * - Load validated config (`@core/config/env`).
 * - Bring up the server via `buildServer()`.
 * - Listen on `config.API_HOST` / `config.API_PORT`.
 * - Graceful shutdown on SIGTERM/SIGINT — `shutdownServer` closes
 *   Fastify + the Prisma singleton.
 */

import { loadConfig } from '@core/config/env.js';

import { buildServer, shutdownServer } from './api-server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildServer();

  const handleTerm = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, 'shutting down');
    void shutdownServer(app)
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
