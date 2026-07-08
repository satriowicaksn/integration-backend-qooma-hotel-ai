// Bridges the T20 `TelegramConfigReadPort` to the T17 `TelegramConfigRepository`.
// Envelope stays encrypted here — the T20 service performs the call-time
// decrypt at dispatch (T20 binding #2). Adapter maps `TelegramConfigDomain`
// to the narrow `TelegramConfigForDispatch` view exposed by the port.

import type { TelegramConfigRepository } from '@modules/telegram/telegram.repository.js';

import type { TelegramConfigReadPort } from '../ports/telegram-config-read.port.js';
import type { TelegramConfigForDispatch } from '../telegram-outbound.types.js';

export class TelegramConfigReadAdapter implements TelegramConfigReadPort {
  constructor(private readonly repo: TelegramConfigRepository) {}

  async getForHotel(input: { hotelId: string }): Promise<TelegramConfigForDispatch | null> {
    const domain = await this.repo.findByHotelId(input.hotelId);
    if (domain === null) return null;
    return {
      botTokenEnc: domain.botTokenEnc,
      botUsername: domain.botUsername,
    };
  }
}
