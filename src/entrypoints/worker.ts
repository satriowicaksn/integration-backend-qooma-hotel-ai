/**
 * Entrypoint: Bull queue worker — Q-C-02 sibling.
 *
 * Responsibilities:
 * - Load validated config (`@core/config/env`).
 * - Establish Prisma singleton lifecycle (so worker cron jobs can persist).
 * - Graceful shutdown on SIGTERM/SIGINT — closes Bull queues + Prisma.
 *
 * Deferred to T##-followup:
 * - T21 OTA IMAP poll cron registration (60s per hotel).
 * - T24 channel-health probe cron registration (60s per hotel).
 * - T14 WA outbound retry-queue processor.
 * - T25 socket-emit consumer bridging T24 → `integration:health_changed`.
 *
 * The entrypoint stays intentionally minimal: it holds the process open
 * and provides shutdown discipline. Queue registrations wire in at each
 * primitive's followup PR, keeping module ownership clean.
 */

import { loadConfig } from '@core/config/env.js';
import { db } from '@core/prisma/prisma-client.js';

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  // T##-followup: await Promise.all([fooQueue.close(), barQueue.close()]);
  await db.$disconnect();
}

async function main(): Promise<void> {
  const config = loadConfig();

  const handleTerm = (signal: NodeJS.Signals): void => {
    // eslint-disable-next-line no-console
    console.warn(`[worker] ${signal} received, draining...`);
    void shutdown()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[worker] error during shutdown:', err);
        process.exit(1);
      });
  };
  process.on('SIGTERM', handleTerm);
  process.on('SIGINT', handleTerm);

  // eslint-disable-next-line no-console
  console.warn(
    `[worker] started (env=${config.NODE_ENV}); queue registrations arrive with T##-followup PRs.`,
  );

  // Keep the process alive until a signal arrives; Bull processors will
  // hook here once the followup PRs land.
  await new Promise<void>(() => {
    /* never resolves — signal handlers drive shutdown */
  });
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal worker error:', err);
  process.exit(1);
});
