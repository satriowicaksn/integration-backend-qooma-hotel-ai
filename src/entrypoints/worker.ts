/**
 * Entrypoint: worker process — Q-C-02 sibling.
 *
 * Responsibilities:
 * - Load validated config (`@core/config/env`).
 * - Establish Prisma singleton lifecycle (so worker cron jobs can persist).
 * - Run periodic cron jobs (interval-based; Bull queue processors land
 *   with future retry-wave followups):
 *     · T21-followup — OTA IMAP poll (spec §3.3).
 *     · T24-followup-B — channel-health probes (spec §7).
 *     · T25-followup — bridge T24 probes → `integration:health_changed`
 *       socket publish.
 * - Graceful shutdown on SIGTERM/SIGINT — clears intervals + disconnects
 *   Prisma.
 *
 * All external IO adapters are STUBS pending PO package approvals +
 * cross-service Q resolutions (see loud startup warns per followup).
 */

import type { AppConfig } from '@core/config/env.js';
import { loadConfig } from '@core/config/env.js';
import { createLogger, type Logger } from '@core/logger/logger.js';
import { db } from '@core/prisma/prisma-client.js';

import {
  ClaudeApiHealthProbeStubAdapter,
  TelegramHealthProbeStubAdapter,
  WhatsappHealthProbeStubAdapter,
} from '@modules/channel-health/adapters/health-probe-stub.adapter.js';
import { ChannelHealthRepository } from '@modules/channel-health/channel-health.repository.js';
import { ChannelHealthService } from '@modules/channel-health/channel-health.service.js';
import { SocketPublisherStubAdapter } from '@modules/integration-health-socket-emit/adapters/socket-publisher-stub.adapter.js';
import { HealthChangedPublisherService } from '@modules/integration-health-socket-emit/integration-health-socket-emit.service.js';
import { HotelCorePendingVisitStubAdapter } from '@modules/ota-mailbox/adapters/hotel-core-pending-visit-stub.adapter.js';
import { ImapFetcherStubAdapter } from '@modules/ota-mailbox/adapters/imap-fetcher-stub.adapter.js';
import { OtaMailboxRepository } from '@modules/ota-mailbox/ota-mailbox.repository.js';
import { OtaPollService } from '@modules/ota-mailbox/ota-poll.service.js';

let shuttingDown = false;
const intervals: NodeJS.Timeout[] = [];

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const handle of intervals) clearInterval(handle);
  await db.$disconnect();
}

function parseHotelList(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new TypeError('HEALTH_PROBE_HOTEL_LIST must be a JSON array of hotelId strings');
  }
  return parsed.map((entry) => {
    if (typeof entry !== 'string' || entry === '') {
      throw new TypeError('HEALTH_PROBE_HOTEL_LIST entries must be non-empty strings');
    }
    return entry;
  });
}

function scheduleOtaPollCron(config: AppConfig, logger: Logger): void {
  if (config.OTA_POLL_INTERVAL_MS === 0) {
    logger.warn({ msg: 'ota_mailbox.cron_disabled', module: 'ota-mailbox' });
    return;
  }
  const repo = new OtaMailboxRepository(db);
  const service = new OtaPollService(
    repo,
    {
      imap: new ImapFetcherStubAdapter(),
      hotelCore: new HotelCorePendingVisitStubAdapter(logger),
    },
    logger,
  );
  logger.warn({
    msg: 'ota_mailbox.startup',
    module: 'ota-mailbox',
    ioAdapters: 'STUB',
    ratifyQs: 'Q-C-09',
    poPackages: 'imap-simple',
    intervalMs: config.OTA_POLL_INTERVAL_MS,
  });
  const handle = setInterval(() => {
    void service.pollAllMailboxes().catch((err: unknown) => {
      logger.error({
        msg: 'ota_mailbox.cron_error',
        module: 'ota-mailbox',
        errCode: err instanceof Error ? err.name : 'unknown',
      });
    });
  }, config.OTA_POLL_INTERVAL_MS);
  intervals.push(handle);
}

function scheduleHealthProbeCron(config: AppConfig, logger: Logger): void {
  if (config.HEALTH_PROBE_INTERVAL_MS === 0) {
    logger.warn({ msg: 'channel_health.cron_disabled', module: 'channel-health' });
    return;
  }
  const hotelIds = parseHotelList(config.HEALTH_PROBE_HOTEL_LIST);
  const repo = new ChannelHealthRepository(db);
  const service = new ChannelHealthService(
    repo,
    {
      whatsapp: new WhatsappHealthProbeStubAdapter(),
      telegram: new TelegramHealthProbeStubAdapter(),
      claudeApi: new ClaudeApiHealthProbeStubAdapter(),
    },
    logger,
  );
  const publisher = new HealthChangedPublisherService(
    new SocketPublisherStubAdapter(logger),
    logger,
  );
  logger.warn({
    msg: 'channel_health.startup',
    module: 'channel-health',
    probeAdapters: 'STUB',
    poPackages: '@anthropic-ai/sdk',
    hotelCount: hotelIds.length,
    intervalMs: config.HEALTH_PROBE_INTERVAL_MS,
  });
  logger.warn({
    msg: 'integration_health_socket_emit.startup',
    module: 'integration-health-socket-emit',
    transport: 'STUB',
    ratifyQs: 'Q-C-12',
    poPackages: 'socket lib TBD',
  });
  const handle = setInterval(() => {
    void runProbeTick(service, publisher, hotelIds, logger);
  }, config.HEALTH_PROBE_INTERVAL_MS);
  intervals.push(handle);
}

async function runProbeTick(
  service: ChannelHealthService,
  publisher: HealthChangedPublisherService,
  hotelIds: readonly string[],
  logger: Logger,
): Promise<void> {
  for (const hotelId of hotelIds) {
    try {
      const events = await service.runProbesForHotel(hotelId);
      if (events.length > 0) {
        await publisher.publishAll(
          events.map((e) => ({
            hotelId: e.hotelId,
            provider: e.provider,
            previousStatus: e.previousStatus,
            newStatus: e.newStatus,
            checkedAt: e.checkedAt,
          })),
        );
      }
    } catch (err) {
      logger.error({
        msg: 'channel_health.cron_error',
        module: 'channel-health',
        hotelId,
        errCode: err instanceof Error ? err.name : 'unknown',
      });
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ service: 'worker', level: config.LOG_LEVEL });

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
  console.warn(`[worker] started (env=${config.NODE_ENV}); registering cron jobs...`);

  scheduleOtaPollCron(config, logger);
  scheduleHealthProbeCron(config, logger);

  // Keep the process alive until a signal arrives.
  await new Promise<void>(() => {
    /* never resolves — signal handlers drive shutdown */
  });
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal worker error:', err);
  process.exit(1);
});
