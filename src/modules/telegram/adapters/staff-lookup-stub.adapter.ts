// MVP stub adapter for `StaffLookupPort` (T19-followup PLAN GAP #1).
// Q-C-06 (HC RPC contract) is unresolved at Parent PM — this stub keeps
// the ingest→persist→dispatch path exercisable end-to-end. Every call
// returns `null`, which the T19 primitive service treats as
// `staff_not_recognized` → silent ignore. Each invocation is logged as
// `hc_rpc_stubbed` so operators can see when a real reply was skipped.
//
// Swap this file for the real HTTP adapter once Q-C-06 lands.

import type { Logger } from '@core/logger/logger.js';

import type { StaffLookupPort } from '../ports/staff-lookup.port.js';
import type { StaffIdentity } from '../telegram-inbound.types.js';

const SUFFIX_LEN = 4;

export class StaffLookupStubAdapter implements StaffLookupPort {
  constructor(private readonly logger: Logger) {}

  async lookupByTelegramUserId(input: {
    hotelId: string;
    telegramUserId: string;
  }): Promise<StaffIdentity | null> {
    this.logger.warn({
      msg: 'telegram_inbound.hc_rpc_stubbed',
      module: 'telegram',
      port: 'staff_lookup',
      hotelId: input.hotelId,
      telegramUserIdSuffix: input.telegramUserId.slice(-SUFFIX_LEN),
    });
    return Promise.resolve(null);
  }
}
