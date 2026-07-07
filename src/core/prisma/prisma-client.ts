/**
 * Prisma client singleton (Q-C-01 resolution).
 *
 * 1 service = 1 DB = 1 Prisma schema (ADR-0004).
 *
 * Constructed at module load — the first import triggers connect on
 * first query. Consumers pass this singleton to repository constructors
 * per ADR-0001 ctor-injection pattern (T17 + T21 + T22 + T24 primitives
 * already ship expecting a `PrismaClient` instance).
 *
 * Usage:
 *   import { db } from '@core/prisma/prisma-client.js';
 *   const repo = new TelegramConfigRepository(db);
 *
 * Graceful shutdown: SIGTERM/SIGINT trigger `$disconnect` so in-flight
 * queries can drain before the container exits.
 */

import { PrismaClient } from '@prisma/client';

import { loadConfig } from '@core/config/env.js';

const config = loadConfig();

export const db = new PrismaClient({
  datasources: { db: { url: config.DATABASE_URL } },
  log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

const shutdown = async (): Promise<void> => {
  await db.$disconnect();
};

process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
