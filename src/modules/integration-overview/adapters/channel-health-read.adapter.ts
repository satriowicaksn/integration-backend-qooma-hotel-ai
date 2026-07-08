// Bridges the T23 `ChannelHealthReadPort` to the T24 `ChannelHealthRepository`.
// Fetches the latest snapshot per provider (WA + Telegram + Claude API) in
// parallel; missing snapshot → `down` pill with a synthetic `lastCheckAt`
// (adapter-local fallback per T23-followup PLAN GAP #2).
//
// This adapter's per-provider fallback lets the aggregator service keep its
// binding #11 wholesale-throw fallback (`syntheticHealthDown()`) reserved for
// the case where the entire port throws — the two layers compose cleanly.

import type { ChannelHealthRepository } from '@modules/channel-health/channel-health.repository.js';
import type {
  ChannelHealthDomain,
  HealthProvider,
} from '@modules/channel-health/channel-health.types.js';

import type {
  ChannelHealthPill,
  ClaudeApiHealthPill,
  HealthOverviewView,
} from '../integration-overview.types.js';
import type { ChannelHealthReadPort } from '../ports/channel-health-read.port.js';

export interface ChannelHealthReadClock {
  now(): Date;
}

const SYSTEM_CLOCK: ChannelHealthReadClock = { now: () => new Date() };

export class ChannelHealthReadAdapter implements ChannelHealthReadPort {
  private readonly clock: ChannelHealthReadClock;

  constructor(
    private readonly repo: ChannelHealthRepository,
    clock?: ChannelHealthReadClock,
  ) {
    this.clock = clock ?? SYSTEM_CLOCK;
  }

  async getSnapshot(input: { hotelId: string }): Promise<HealthOverviewView> {
    const [wa, telegram, claude] = await Promise.all([
      this.repo.findLatestByHotelProvider(input.hotelId, 'whatsapp'),
      this.repo.findLatestByHotelProvider(input.hotelId, 'telegram'),
      this.repo.findLatestByHotelProvider(input.hotelId, 'claude_api'),
    ]);
    return {
      whatsapp: this.toChannelPill(wa),
      telegram: this.toChannelPill(telegram),
      claudeApi: this.toClaudePill(claude),
    };
  }

  private toChannelPill(row: ChannelHealthDomain | null): ChannelHealthPill {
    if (row === null) return { status: 'down', lastMessageAt: null };
    return { status: row.status, lastMessageAt: row.checkedAt.toISOString() };
  }

  private toClaudePill(row: ChannelHealthDomain | null): ClaudeApiHealthPill {
    if (row === null) {
      return { status: 'down', lastCheckAt: this.clock.now().toISOString() };
    }
    return { status: row.status, lastCheckAt: row.checkedAt.toISOString() };
  }
}

// Re-export for tests that need the type name — narrow surface.
export type { HealthProvider };
