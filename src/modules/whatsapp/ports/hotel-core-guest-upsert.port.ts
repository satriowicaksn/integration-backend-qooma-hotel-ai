/**
 * Cross-service RPC port — Integration → Hotel Core, resolves a guest
 * identity from a WhatsApp phone number (spec §3.1 L115 `upsert_guest_by_wa_phone`).
 *
 * **TYPE-ONLY** in this primitive per PM B ACK GAP T12-#3 → Q-B-04: the
 * concrete HTTP adapter (`http-hotel-core-guest-upsert.adapter.ts`) is
 * deferred to **T12-followup** and lands only after (a) Q-B-04 ratifies the HC
 * endpoint contract (URL / path / request/response shape / error catalog) AND
 * (b) Q-C-02 wires `HC_BASE_URL` + `INTERNAL_SECRET` into
 * `core/config/env.ts` + `api.ts` / `worker.ts` bootstrap. The service
 * consumes this port abstractly; unit tests inject a jest test-double.
 */

import type { GuestUpsertInput, GuestUpsertResult } from '../whatsapp-webhook-ingest.types.js';

export interface HotelCoreGuestUpsertPort {
  upsertGuestByWaPhone(input: GuestUpsertInput): Promise<GuestUpsertResult>;
}
