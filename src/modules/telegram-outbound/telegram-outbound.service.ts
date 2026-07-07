// Dispatch orchestrator: looks up the hotel's Telegram config via reader
// port → decrypts bot_token at call time → invokes Bot API adapter →
// returns { messageId, sentAt }.
//
// **Discipline highlights** (PM C ACK T20 bindings):
// #2  Call-time decrypt; token kept in a single stack frame; NEVER
//     cached, logged, or echoed.
// #3  `botToken` is NEVER logged. Only used as an argument to
//     TelegramBotApiPort.sendMessage.
// #4  Log line uses `chatIdSuffix: chatId.slice(-4)` — group IDs like
//     -100... are fine, individual user IDs are PII. Extends slot-B's
//     maskWaPhone last-4 precedent to Telegram.
// #5  Body content is NEVER logged. Only `bodyLength: body.length`.
// #9  Error mapping: NotFoundError (config missing) / ExternalServiceError
//     (Bot API adapter throw).
// #10 Clock-injected sent_at (SYSTEM_CLOCK default).

import { ExternalServiceError, NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { decrypt } from '@shared/utils/crypto.js';

import type { TelegramBotApiPort } from './ports/telegram-bot-api.port.js';
import type { TelegramConfigReadPort } from './ports/telegram-config-read.port.js';
import type { SendTelegramMessageInput, TelegramSendResult } from './telegram-outbound.types.js';

export interface TelegramDispatchPorts {
  readonly config: TelegramConfigReadPort;
  readonly botApi: TelegramBotApiPort;
}

export interface DispatchClock {
  now(): Date;
}

const SYSTEM_CLOCK: DispatchClock = { now: () => new Date() };

const CHAT_ID_SUFFIX_LENGTH = 4;

export class TelegramDispatchService {
  private readonly clock: DispatchClock;

  constructor(
    private readonly ports: TelegramDispatchPorts,
    private readonly logger: Logger,
    clock?: DispatchClock,
  ) {
    this.clock = clock ?? SYSTEM_CLOCK;
  }

  async sendMessage(input: SendTelegramMessageInput): Promise<TelegramSendResult> {
    const config = await this.ports.config.getForHotel({ hotelId: input.hotelId });
    if (config === null) {
      throw new NotFoundError('telegram_config', input.hotelId);
    }

    const botToken = decrypt(config.botTokenEnc);

    let apiResult;
    try {
      apiResult = await this.ports.botApi.sendMessage({
        botToken,
        chatId: input.chatId,
        body: input.body,
        ...(input.parseMode !== undefined ? { parseMode: input.parseMode } : {}),
      });
    } catch (err) {
      throw new ExternalServiceError('telegram_bot_api', errorMessage(err));
    }

    const sentAt = this.clock.now();

    this.logger.info({
      msg: 'telegram_outbound.dispatched',
      module: 'telegram-outbound',
      hotelId: input.hotelId,
      chatIdSuffix: input.chatId.slice(-CHAT_ID_SUFFIX_LENGTH),
      messageId: apiResult.messageId,
      bodyLength: input.body.length,
      ...(input.parseMode !== undefined ? { parseMode: input.parseMode } : {}),
    });

    return {
      messageId: apiResult.messageId,
      sentAt,
    };
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
