// Business logic: Telegram config get/upsert with encrypt-at-rest + mask-in-view.
// Spec: MVP-INTEGRATION-FIRST.md §4.1 (encrypt bot_token) + §5 L124 CRUD AC.
// PII floor: log line masks bot_token BEFORE encrypt (never persist plaintext).

import { NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { decrypt, encrypt } from '@shared/utils/crypto.js';
import { maskTokenForLog } from '@shared/utils/masking.js';

import type { TelegramConfigRepository } from './telegram.repository.js';
import type { TelegramConfigPutDto } from './telegram.schema.js';
import type { TelegramConfigDomain, TelegramConfigView } from './telegram.types.js';

export class TelegramConfigService {
  constructor(
    private readonly repository: TelegramConfigRepository,
    private readonly logger: Logger,
  ) {}

  async get(hotelId: string): Promise<TelegramConfigView> {
    const domain = await this.repository.findByHotelId(hotelId);
    if (domain === null) {
      throw new NotFoundError('telegram_config', hotelId);
    }
    return this.toView(domain);
  }

  async upsert(hotelId: string, input: TelegramConfigPutDto): Promise<TelegramConfigView> {
    this.logger.info({
      msg: 'telegram_config.upsert',
      module: 'telegram',
      hotelId,
      botToken: maskTokenForLog(input.botToken),
      botUsername: input.botUsername,
    });
    const botTokenEnc = encrypt(input.botToken);
    const domain = await this.repository.upsert(hotelId, {
      botTokenEnc,
      botUsername: input.botUsername,
      defaultChatId: input.defaultChatId ?? null,
      gmTelegramId: input.gmTelegramId ?? null,
      webhookUrl: input.webhookUrl ?? null,
    });
    return this.toView(domain);
  }

  private toView(domain: TelegramConfigDomain): TelegramConfigView {
    const plaintext = decrypt(domain.botTokenEnc);
    return {
      hotelId: domain.hotelId,
      botToken: maskTokenForLog(plaintext),
      botUsername: domain.botUsername,
      defaultChatId: domain.defaultChatId,
      gmTelegramId: domain.gmTelegramId,
      webhookUrl: domain.webhookUrl,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }
}
