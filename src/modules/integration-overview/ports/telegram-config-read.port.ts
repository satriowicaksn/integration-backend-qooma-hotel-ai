// Reader port for the Telegram subsystem view. TYPE-ONLY. Adapter wires
// against `@modules/telegram` barrel (T17 primitive) in T23-followup.

import type { TelegramOverviewView } from '../integration-overview.types.js';

export interface TelegramConfigReadPort {
  getForHotel(input: { hotelId: string }): Promise<TelegramOverviewView | null>;
}
