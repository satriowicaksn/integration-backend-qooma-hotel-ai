// Reader port for the WhatsApp subsystem view (spec §2.1 row 27 aggregation).
// TYPE-ONLY. Adapter (T23-followup) wires this against the slot-B
// `@modules/whatsapp` barrel (from PR #10 primitive); PM C ACK T23 binding
// #1 permits barrel imports at the adapter layer.

import type { WhatsappOverviewView } from '../integration-overview.types.js';

export interface WhatsappConfigReadPort {
  getForHotel(input: { hotelId: string }): Promise<WhatsappOverviewView | null>;
}
