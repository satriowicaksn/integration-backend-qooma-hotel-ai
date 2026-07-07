// Aggregator: composes an IntegrationOverview from 4 subsystem read ports
// (spec §2.1 row 27). PM C ACK T23 binding disciplines:
// #9 — parallel `Promise.allSettled` so one throw does not reject aggregate
// #10 — structured warn log on per-subsystem failure (no plaintext bodies)
// #11 — health failure returns synthetic "down" snapshot, never null
//
// Zero `@prisma/client` import (binding #2) and zero cross-module imports
// (binding #3) — first slot-C primitive projected to break the
// Q-C-05 Docker-red streak.

import type { Logger } from '@core/logger/logger.js';

import type {
  HealthOverviewView,
  IntegrationOverview,
  OverviewSubsystem,
  QrOverviewView,
  TelegramOverviewView,
  WhatsappOverviewView,
} from './integration-overview.types.js';
import type { ChannelHealthReadPort } from './ports/channel-health-read.port.js';
import type { QrStateReadPort } from './ports/qr-state-read.port.js';
import type { TelegramConfigReadPort } from './ports/telegram-config-read.port.js';
import type { WhatsappConfigReadPort } from './ports/whatsapp-config-read.port.js';

export interface IntegrationOverviewPorts {
  readonly whatsapp: WhatsappConfigReadPort;
  readonly telegram: TelegramConfigReadPort;
  readonly qr: QrStateReadPort;
  readonly health: ChannelHealthReadPort;
}

export interface OverviewClock {
  now(): Date;
}

const SYSTEM_CLOCK: OverviewClock = { now: () => new Date() };

export class IntegrationOverviewService {
  private readonly clock: OverviewClock;

  constructor(
    private readonly ports: IntegrationOverviewPorts,
    private readonly logger: Logger,
    clock?: OverviewClock,
  ) {
    this.clock = clock ?? SYSTEM_CLOCK;
  }

  async getForHotel(hotelId: string): Promise<IntegrationOverview> {
    const input = { hotelId };
    const [whatsapp, telegram, qr, health] = await Promise.all([
      this.readNullable('whatsapp', this.ports.whatsapp.getForHotel(input), hotelId),
      this.readNullable('telegram', this.ports.telegram.getForHotel(input), hotelId),
      this.readNullable('qr', this.ports.qr.getForHotel(input), hotelId),
      this.readHealth(hotelId, input),
    ]);
    return { whatsapp, telegram, qr, health };
  }

  private async readNullable<T>(
    subsystem: Exclude<OverviewSubsystem, 'health'>,
    pending: Promise<T | null>,
    hotelId: string,
  ): Promise<T | null> {
    try {
      return await pending;
    } catch (err) {
      this.logSubsystemFailure(subsystem, hotelId, err);
      return null;
    }
  }

  private async readHealth(
    hotelId: string,
    input: { hotelId: string },
  ): Promise<HealthOverviewView> {
    try {
      return await this.ports.health.getSnapshot(input);
    } catch (err) {
      this.logSubsystemFailure('health', hotelId, err);
      return this.syntheticHealthDown();
    }
  }

  private syntheticHealthDown(): HealthOverviewView {
    const lastCheckAt = this.clock.now().toISOString();
    return {
      whatsapp: { status: 'down' },
      telegram: { status: 'down' },
      claudeApi: { status: 'down', lastCheckAt },
    };
  }

  private logSubsystemFailure(subsystem: OverviewSubsystem, hotelId: string, err: unknown): void {
    this.logger.warn({
      msg: 'integration_overview.subsystem_read_failed',
      module: 'integration-overview',
      hotelId,
      subsystem,
      errCode: extractCode(err),
    });
  }
}

function extractCode(err: unknown): string {
  if (err instanceof Error && err.name !== 'Error') {
    return err.name;
  }
  return 'unknown';
}

// Types exported for the (future) route composer.
export type {
  HealthOverviewView,
  IntegrationOverview,
  QrOverviewView,
  TelegramOverviewView,
  WhatsappOverviewView,
};
