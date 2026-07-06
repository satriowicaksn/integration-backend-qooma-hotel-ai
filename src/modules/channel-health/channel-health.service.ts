// Orchestrator: for each of the 3 providers (WA / Telegram / Claude), fetch
// the latest snapshot, run its probe, apply the debounce rule, persist a new
// snapshot (per-poll insert per PM C ACK §558 GAP-#1 default), and collect
// HealthChangedEvent[] for the caller (T25/C9 socket emitter) to publish.
//
// This service is stateless w.r.t. cron cadence — the Bull cron worker
// (T24-followup) calls `runProbesForHotel(hotelId)` per tick per hotel.

import type { Logger } from '@core/logger/logger.js';

import { applyDebounce } from './channel-health.debounce.js';
import type { ChannelHealthRepository } from './channel-health.repository.js';
import type {
  ChannelHealthDomain,
  HealthChangedEvent,
  HealthProvider,
  ProbeResult,
} from './channel-health.types.js';
import type { ClaudeApiHealthProbePort } from './ports/claude-api-health-probe.port.js';
import type { TelegramHealthProbePort } from './ports/telegram-health-probe.port.js';
import type { WhatsappHealthProbePort } from './ports/whatsapp-health-probe.port.js';

export interface ChannelHealthProbes {
  readonly whatsapp: WhatsappHealthProbePort;
  readonly telegram: TelegramHealthProbePort;
  readonly claudeApi: ClaudeApiHealthProbePort;
}

export class ChannelHealthService {
  constructor(
    private readonly repository: ChannelHealthRepository,
    private readonly probes: ChannelHealthProbes,
    private readonly logger: Logger,
  ) {}

  async runProbesForHotel(hotelId: string): Promise<HealthChangedEvent[]> {
    const events: HealthChangedEvent[] = [];
    for (const provider of PROVIDER_ORDER) {
      const event = await this.runProbeForProvider(hotelId, provider);
      if (event !== null) {
        events.push(event);
      }
    }
    return events;
  }

  private async runProbeForProvider(
    hotelId: string,
    provider: HealthProvider,
  ): Promise<HealthChangedEvent | null> {
    const previous = await this.repository.findLatestByHotelProvider(hotelId, provider);
    const probe = await this.invokeProbe(provider, hotelId);
    const transition = applyDebounce(previous?.status ?? null, probe);

    const snapshot = await this.repository.insertSnapshot({
      hotelId,
      provider,
      status: transition.nextStatus,
      latencyMs: probe.ok ? probe.latencyMs : null,
    });

    this.logger.info({
      msg: 'channel_health.probed',
      module: 'channel-health',
      hotelId,
      provider,
      status: transition.nextStatus,
      latencyMs: snapshot.latencyMs,
      transitioned: transition.didTransition,
    });

    if (!transition.didTransition) {
      return null;
    }
    return {
      hotelId,
      provider,
      previousStatus: transition.previousStatus,
      newStatus: transition.nextStatus,
      checkedAt: snapshot.checkedAt,
    };
  }

  private invokeProbe(provider: HealthProvider, hotelId: string): Promise<ProbeResult> {
    switch (provider) {
      case 'whatsapp':
        return this.probes.whatsapp.probe({ hotelId });
      case 'telegram':
        return this.probes.telegram.probe({ hotelId });
      case 'claude_api':
        return this.probes.claudeApi.probe({ hotelId });
    }
  }
}

// exported for the (future) `GET /api/integrations/health` route composer;
// keeps ordering deterministic for tests + logs.
export const PROVIDER_ORDER: readonly HealthProvider[] = [
  'whatsapp',
  'telegram',
  'claude_api',
] as const;

/** Convenience: derive the "current" status from the latest snapshot (or
 * `healthy` fallback if never probed — spec §2.2 badge assumes optimistic
 * default until first probe lands). Used by the route composer in T24-followup;
 * not exercised inside the primitive itself. */
export function currentStatusOr(latest: ChannelHealthDomain | null): ChannelHealthDomain['status'] {
  return latest?.status ?? 'healthy';
}
