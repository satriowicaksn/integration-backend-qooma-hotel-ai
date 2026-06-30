/**
 * Prisma client singleton.
 *
 * 1 service = 1 DB = 1 Prisma schema (ADR-0004).
 *
 * Usage:
 *   import { db } from '@core/prisma/prisma-client.js';
 *   const items = await db.exampleResource.findMany();
 */

// TODO(boilerplate): generate client via `pnpm prisma:generate`, lalu uncomment:
//
// import { PrismaClient } from '@prisma/client';
// import { loadConfig } from '@core/config/env.js';
//
// const config = loadConfig();
//
// export const db = new PrismaClient({
//   datasources: { db: { url: config.DATABASE_URL } },
//   log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
// });
//
// const shutdown = async (): Promise<void> => {
//   await db.$disconnect();
// };
// process.on('SIGTERM', shutdown);
// process.on('SIGINT', shutdown);

export const db = {} as unknown as Record<string, unknown>; // placeholder
