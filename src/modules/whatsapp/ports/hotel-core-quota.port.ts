/**
 * Cross-service RPC port — Integration → Hotel Core outbound quota (spec §4.5
 * two-phase). Phase 1 reserves; Phase 2 commits on Meta success OR rolls
 * back on Meta failure per binding condition #11 (spec §4.5 wording "meter
 * reflects only actually-sent messages").
 *
 * **TYPE-ONLY** in this primitive per PM B ACK GAP T13-#1 → Q-B-08: the
 * concrete HTTP adapter (`http-hotel-core-quota.adapter.ts`) is deferred to
 * **T13-followup** and lands only after (a) Q-B-08 ratifies the HC endpoint
 * contract (URL / path / payload / response / error catalog + `reservationId`
 * TTL semantics) AND (b) Q-C-02 wires `HC_BASE_URL` + `INTERNAL_SECRET` into
 * `core/config/env.ts`. Unit tests inject a jest test-double.
 */

import type { QuotaCheckResult } from '../whatsapp-outbound-dispatch.types.js';

export interface HotelCoreQuotaPort {
  checkAndReserve(hotelId: string, count: number): Promise<QuotaCheckResult>;
  commit(reservationId: string): Promise<void>;
  rollback(reservationId: string): Promise<void>;
}
