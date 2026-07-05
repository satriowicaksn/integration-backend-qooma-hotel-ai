/**
 * Cross-service RPC port — Integration → Hotel Core DND check (spec §4.4).
 * Returns `{ blocked, vvipExempt }`; service bypasses DND rejection when
 * `blocked: true` AND `vvipExempt: true` (VVIP-exempt spec bypass). Inbound-
 * trigger flag is caller responsibility (HC/AI decide when sending) and is
 * not modeled in this port.
 *
 * **TYPE-ONLY** in this primitive per PM B ACK GAP T13-#2 → Q-B-09: the
 * concrete HTTP adapter (`http-hotel-core-dnd.adapter.ts`) is deferred to
 * **T13-followup** and lands only after (a) Q-B-09 ratifies the HC endpoint
 * contract (URL / path / payload / response / whether DND lives in HC or
 * Auth — HC-team's call) AND (b) Q-C-02 wires config. Unit tests inject a
 * jest test-double.
 */

import type { DndCheckResult } from '../whatsapp-outbound-dispatch.types.js';

export interface HotelCoreDndPort {
  isDndForRecipient(hotelId: string, recipientPhone: string): Promise<DndCheckResult>;
}
