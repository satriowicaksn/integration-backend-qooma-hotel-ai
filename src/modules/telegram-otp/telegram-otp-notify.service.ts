// ADD-24 OTP ticket notification: posts the dept-group message WITH the
// 4-button inline keyboard, registers the resulting message_id with Hotel
// Core (so 2-digit replies can be resolved back to the ticket), and
// persists the local resend context (guest WA coordinates).
//
// ANTI-CHEAT: the body arrives from the caller (ticket number/title + room)
// and this service adds only the keyboard — no code ever enters this flow.

import type { Logger } from '@core/logger/logger.js';

import type { TelegramParseMode, TelegramSendResult } from '@modules/telegram-outbound/index.js';

import type { HotelCoreOtpPort } from './ports/hotel-core-otp.port.js';
import type { TelegramSendPort } from './ports/telegram-send.port.js';
import { buildOtpKeyboard } from './telegram-otp.keyboard.js';
import type { OtpTicketContextRepository } from './telegram-otp.repository.js';

export interface OtpTicketNotifyInput {
  readonly hotelId: string;
  readonly chatId: string;
  readonly body: string;
  readonly parseMode?: TelegramParseMode;
  readonly ticketId: string;
  readonly guestWaPhone?: string;
  readonly guestId?: string;
}

export interface TelegramOtpNotifyDeps {
  readonly core: HotelCoreOtpPort;
  readonly telegram: TelegramSendPort;
  readonly repo: OtpTicketContextRepository;
}

export class TelegramOtpNotifyService {
  constructor(
    private readonly deps: TelegramOtpNotifyDeps,
    private readonly logger: Logger,
  ) {}

  async notifyTicket(input: OtpTicketNotifyInput): Promise<TelegramSendResult> {
    const result = await this.deps.telegram.sendMessage({
      hotelId: input.hotelId,
      chatId: input.chatId,
      body: input.body,
      ...(input.parseMode !== undefined ? { parseMode: input.parseMode } : {}),
      replyMarkup: buildOtpKeyboard(input.ticketId),
    });

    const telegramMessageId = Number(result.messageId);
    if (Number.isInteger(telegramMessageId)) {
      // Mapping + context failures must not overturn the dispatch — the
      // group message is already posted. Reply-verify would then miss for
      // this ticket; ops sees the error line.
      try {
        await this.deps.core.storeTelegramMessage({ ticketId: input.ticketId, telegramMessageId });
      } catch (err) {
        this.logError('telegram_otp.store_mapping_failed', input, err);
      }
      try {
        await this.deps.repo.upsert({
          ticketId: input.ticketId,
          hotelId: input.hotelId,
          chatId: input.chatId,
          telegramMessageId,
          ...(input.guestWaPhone !== undefined ? { guestWaPhone: input.guestWaPhone } : {}),
          ...(input.guestId !== undefined ? { guestId: input.guestId } : {}),
        });
      } catch (err) {
        this.logError('telegram_otp.context_persist_failed', input, err);
      }
    } else {
      this.logError('telegram_otp.non_numeric_message_id', input, null);
    }

    this.logger.info({
      msg: 'telegram_otp.notified',
      module: 'telegram-otp',
      hotelId: input.hotelId,
      ticketId: input.ticketId,
      messageId: result.messageId,
    });

    return result;
  }

  private logError(msg: string, input: OtpTicketNotifyInput, err: unknown): void {
    this.logger.error({
      msg,
      module: 'telegram-otp',
      hotelId: input.hotelId,
      ticketId: input.ticketId,
      ...(err !== null ? { errCode: err instanceof Error ? err.name : 'unknown' } : {}),
    });
  }
}
