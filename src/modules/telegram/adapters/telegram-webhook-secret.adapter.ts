// Resolves the per-hotel secret compared against Telegram's
// `X-Telegram-Bot-Api-Secret-Token` header. MVP choice per T19-followup
// PLAN GAP #2: use the decrypted `bot_token` as the webhook secret.
// A dedicated `webhook_secret_enc` column is a future schema-change task.
//
// The bot_token is decrypted at call-time and kept in a single stack
// frame; NEVER cached, logged, or echoed (T20 binding #2 discipline).

import { NotFoundError } from '@core/errors/app-errors.js';

import { decrypt } from '@shared/utils/crypto.js';

import type { TelegramConfigRepository } from '../telegram.repository.js';

export class TelegramWebhookSecretResolver {
  constructor(private readonly repo: TelegramConfigRepository) {}

  async resolveSecret(input: { hotelId: string }): Promise<string> {
    const domain = await this.repo.findByHotelId(input.hotelId);
    if (domain === null) {
      throw new NotFoundError('telegram_config', input.hotelId);
    }
    return decrypt(domain.botTokenEnc);
  }
}
