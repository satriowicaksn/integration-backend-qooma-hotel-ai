/**
 * Entrypoint: HTTP API server (Fastify).
 *
 * Tanggung jawab:
 * - Register Fastify plugins (auth, hmac-validator, rate-limit, cors, error-handler)
 * - Wire up adapter → port → service (manual DI)
 * - Register module routes
 * - Graceful shutdown
 */

export {}; // ESM module marker — prevents global scope collision with worker.ts

// TODO(boilerplate): implementasi setelah dependencies install + core modules siap.
//
// import Fastify from 'fastify';
// import { loadConfig } from '@core/config/env.js';
// import { createLogger } from '@core/logger/logger.js';
// ... wire up

async function main(): Promise<void> {
  // const config = loadConfig();
  // const logger = createLogger({ service: 'api', level: config.LOG_LEVEL });
  // const fastify = Fastify({ logger });
  //
  // await fastify.register(corsPlugin);
  // await fastify.register(helmetPlugin);
  // await fastify.register(rateLimitPlugin);
  // await fastify.register(correlationIdPlugin);
  // await fastify.register(authJwtPlugin);
  //
  // const services = await buildServices(config);
  // fastify.decorate('services', services);
  //
  // await fastify.register(yourRoutes, { prefix: '/api' });
  //
  // await fastify.listen({ port: config.API_PORT, host: config.API_HOST });

  console.warn('[api] Entrypoint stub — implementasi setelah core/plugins siap.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
