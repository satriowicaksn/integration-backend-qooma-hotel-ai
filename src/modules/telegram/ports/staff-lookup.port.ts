// Cross-service RPC port — Integration → Hotel Core: resolve a staff identity
// from a Telegram user id (spec §3.2 "identify the staff Telegram user").
//
// TYPE-ONLY in this primitive: the concrete HTTP adapter lands in T19-followup
// after (a) Q-C-03 ratifies HC internal-RPC client-side contract, and
// (b) `HC_BASE_URL` + `INTERNAL_SECRET` are wired into env + entrypoint bootstrap.
// The service consumes this port abstractly; unit tests inject a jest fake.

import type { StaffIdentity } from '../telegram-inbound.types.js';

export interface StaffLookupPort {
  lookupByTelegramUserId(input: {
    hotelId: string;
    telegramUserId: string;
  }): Promise<StaffIdentity | null>;
}
