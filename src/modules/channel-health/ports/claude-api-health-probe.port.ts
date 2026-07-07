// Probe port for Claude API health (spec §7). Adapter + SDK add
// (`@anthropic-ai/sdk` → PO approval per PM C ACK §560 GAP-#3) deferred to
// T24-followup. Type-only.

import type { ProbeResult } from '../channel-health.types.js';

export interface ClaudeApiHealthProbePort {
  probe(input: { hotelId: string }): Promise<ProbeResult>;
}
