// Probe port for WhatsApp Cloud API health (spec §7). Adapter deferred to
// T24-followup along with cron worker wiring; unit tests inject a plain jest
// fake. Type-only, mirrors slot-B `hotel-core-*.port.ts` + T19
// `staff-lookup.port.ts` precedent.

import type { ProbeResult } from '../channel-health.types.js';

export interface WhatsappHealthProbePort {
  probe(input: { hotelId: string }): Promise<ProbeResult>;
}
