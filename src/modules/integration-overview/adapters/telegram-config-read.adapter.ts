// Bridges the T23 `TelegramConfigReadPort` to the T17 `TelegramConfigRepository`.
// Maps the persisted domain to the narrow status-oriented view the overview
// aggregator returns.

import type { TelegramConfigRepository } from '@modules/telegram/telegram.repository.js';

import type { TelegramOverviewView } from '../integration-overview.types.js';
import type { TelegramConfigReadPort } from '../ports/telegram-config-read.port.js';

export class TelegramConfigReadAdapter implements TelegramConfigReadPort {
  constructor(private readonly repo: TelegramConfigRepository) {}

  async getForHotel(input: { hotelId: string }): Promise<TelegramOverviewView | null> {
    const domain = await this.repo.findByHotelId(input.hotelId);
    if (domain === null) return null;
    return {
      botUsername: domain.botUsername,
      hasBotToken: domain.botTokenEnc.length > 0,
      defaultChatId: domain.defaultChatId,
      webhookUrl: domain.webhookUrl,
    };
  }
}
