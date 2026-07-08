// HTTP route for T24-followup channel-health READ endpoint
// (spec 04-integration-channels.md §2.2 row 48).
//
// Thin layer: 3 parallel repo reads (WA + Telegram + Claude API) →
// `toHealthResponseDto` pure helper → snake_case wire response.
//
// **Scope note** (T24-followup PLAN GAPs #2/#3): `last_message_at` and
// `uptime_30d` / `avg_response_ms` are DEFERRED. Their schema fields are
// `.nullable().optional()` so this MVP shape is valid. A follow-up PR
// composes `last_message_at` from `MAX(outbound_dispatch.sent_at)` /
// `MAX(webhook_events.received_at)` (spec §channel-health.schema.ts:11)
// and aggregates the 30-day snapshot window for Claude uptime/latency.

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { AuthError } from '@core/errors/app-errors.js';

import type { ChannelHealthRepository } from './channel-health.repository.js';
import type { ClaudeApiHealthDto, HealthResponseDto } from './channel-health.schema.js';
import { PROVIDER_ORDER, currentStatusOr } from './channel-health.service.js';
import type { ChannelHealthDomain } from './channel-health.types.js';

export interface ChannelHealthRoutesClock {
  now(): Date;
}

const SYSTEM_CLOCK: ChannelHealthRoutesClock = { now: () => new Date() };

export interface ChannelHealthRoutesOptions {
  readonly repository: ChannelHealthRepository;
  readonly guards: readonly preHandlerHookHandler[];
  readonly clock?: ChannelHealthRoutesClock;
}

export const channelHealthRoutes: FastifyPluginAsync<ChannelHealthRoutesOptions> = (
  fastify,
  opts,
) => {
  const preHandler = [...opts.guards] as preHandlerHookHandler[];
  const clock = opts.clock ?? SYSTEM_CLOCK;

  fastify.get('/api/integrations/health', { preHandler }, async (req) => {
    const hotelId = requireHotelId(req.hotelId);
    const snapshots = await Promise.all(
      PROVIDER_ORDER.map((provider) =>
        opts.repository.findLatestByHotelProvider(hotelId, provider),
      ),
    );
    const [wa, telegram, claude] = snapshots as [
      ChannelHealthDomain | null,
      ChannelHealthDomain | null,
      ChannelHealthDomain | null,
    ];
    return toHealthResponseDto({ wa, telegram, claude }, clock);
  });

  return Promise.resolve();
};

function requireHotelId(candidate: string | undefined): string {
  if (candidate === undefined || candidate === '') {
    throw new AuthError('Tenant scope missing on request');
  }
  return candidate;
}

export interface HealthSnapshotTriple {
  readonly wa: ChannelHealthDomain | null;
  readonly telegram: ChannelHealthDomain | null;
  readonly claude: ChannelHealthDomain | null;
}

export function toHealthResponseDto(
  snapshots: HealthSnapshotTriple,
  clock: ChannelHealthRoutesClock,
): HealthResponseDto {
  return {
    whatsapp: {
      status: currentStatusOr(snapshots.wa),
      last_message_at: null,
    },
    telegram: {
      status: currentStatusOr(snapshots.telegram),
      last_message_at: null,
    },
    claude_api: toClaudeDto(snapshots.claude, clock),
  };
}

function toClaudeDto(
  snap: ChannelHealthDomain | null,
  clock: ChannelHealthRoutesClock,
): ClaudeApiHealthDto {
  return {
    status: currentStatusOr(snap),
    last_check_at: snap?.checkedAt.toISOString() ?? clock.now().toISOString(),
  };
}
