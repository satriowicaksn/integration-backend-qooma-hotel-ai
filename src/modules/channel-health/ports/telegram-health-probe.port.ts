// Probe port for Telegram Bot API health (spec §7 — poll `getMe` every 60s).
// Adapter deferred to T24-followup. Type-only.

import type { ProbeResult } from '../channel-health.types.js';

export interface TelegramHealthProbePort {
  probe(input: { hotelId: string }): Promise<ProbeResult>;
}
