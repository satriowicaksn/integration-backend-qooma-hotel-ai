// Reader port for the Telegram config the dispatch flow needs.
// TYPE-ONLY. Adapter (T20-followup) wires this against the T17
// Telegram-config barrel and maps `TelegramConfigDomain` to the narrow
// `TelegramConfigForDispatch` view.
//
// Reader-port pattern per T23 §1262 first-class slot-C architecture +
// PM C ACK T20 binding #1: primitive does NOT import from
// `@modules/telegram` at runtime; adapter layer bridges.

import type { TelegramConfigForDispatch } from '../telegram-outbound.types.js';

export interface TelegramConfigReadPort {
  getForHotel(input: { hotelId: string }): Promise<TelegramConfigForDispatch | null>;
}
