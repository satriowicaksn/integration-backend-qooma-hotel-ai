// Reader-port adapter (T97): bridges the T17 TelegramConfigRepository to the
// narrow `TelegramConfigForDispatch` view the dispatch primitive consumes.
// Keeps the primitive free of `@modules/telegram` runtime coupling per
// PM C ACK T20 binding #1 — the bridge lives at adapter layer.

import type { TelegramConfigRepository } from '@modules/telegram/index.js';

import type { TelegramConfigReadPort } from '../ports/telegram-config-read.port.js';
import type { TelegramConfigForDispatch } from '../telegram-outbound.types.js';

export class TelegramConfigDispatchReadAdapter implements TelegramConfigReadPort {
  constructor(private readonly repo: TelegramConfigRepository) {}

  async getForHotel(input: { hotelId: string }): Promise<TelegramConfigForDispatch | null> {
    const config = await this.repo.findByHotelId(input.hotelId);
    if (config === null) return null;
    return { botTokenEnc: config.botTokenEnc, botUsername: config.botUsername };
  }
}
