// ADD-24 OTP interaction handler — implements the telegram module's
// OtpInteractionPort for the 4 inline-keyboard actions + 2-digit reply
// verification. Business rules (wrong-code max 3×, resend max 2×, grace
// timer) are ENFORCED BY HOTEL CORE; this service relays and renders.
//
// ANTI-CHEAT: the only place a code value exists here is (a) the reply
// attempt forwarded verbatim to Core's verify RPC and (b) Core's resend
// result composed into the GUEST WA body. Neither is ever put into a
// Telegram payload or a log line.

import type { Logger } from '@core/logger/logger.js';

import type {
  OtpCallbackInteraction,
  OtpInteractionPort,
  OtpReplyCodeInteraction,
} from '@modules/telegram/index.js';

import type { GuestWaSendPort } from './ports/guest-wa-send.port.js';
import type { HotelCoreOtpPort } from './ports/hotel-core-otp.port.js';
import type { TelegramSendPort } from './ports/telegram-send.port.js';
import { parseOtpCallbackData } from './telegram-otp.keyboard.js';
import type { OtpTicketContextRepository } from './telegram-otp.repository.js';
import type { OtpVerifyResult } from './telegram-otp.types.js';

export interface TelegramOtpCallbackDeps {
  readonly core: HotelCoreOtpPort;
  readonly telegram: TelegramSendPort;
  readonly repo: OtpTicketContextRepository;
  readonly waSend?: GuestWaSendPort;
}

export interface OtpClock {
  now(): Date;
}

const SYSTEM_CLOCK: OtpClock = { now: () => new Date() };
const MS_PER_MINUTE = 60_000;
const LOG_MODULE = 'telegram-otp';

const ACK_TEXT = {
  done: 'Pengantaran dicatat.',
  nocode: 'Tiket ditutup tanpa kode.',
  declined: 'Dicatat: tamu menolak kode.',
  resend_ok: 'Kode dikirim ulang ke tamu.',
  resend_limit: 'Batas kirim ulang tercapai.',
  resend_failed: 'Kirim ulang gagal.',
  error: 'Terjadi kesalahan. Coba lagi.',
} as const;

const NOTE_NOCODE = 'Tiket ditutup tanpa verifikasi kode.';
const NOTE_DECLINED = 'Tamu menolak kode — tiket ditutup tanpa verifikasi (tercatat).';
const NOTE_RESEND_OK = 'Kode verifikasi telah dikirim ulang ke WhatsApp tamu.';
const NOTE_RESEND_LIMIT =
  'Batas kirim ulang kode sudah tercapai — lanjutkan verifikasi manual atau tutup tanpa kode.';
const NOTE_RESEND_NOT_APPLICABLE = 'Kirim ulang tidak berlaku untuk tiket ini.';
const NOTE_RESEND_NO_GUEST =
  'Kirim ulang tidak dapat diproses otomatis — data kontak tamu tidak tersedia di layanan integrasi.';
const NOTE_RESEND_SEND_FAILED = 'Gagal mengirim ulang kode ke tamu — coba lagi sebentar lagi.';

function graceNote(deadline: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((deadline.getTime() - now.getTime()) / MS_PER_MINUTE));
  return `Grace ±${minutes} menit berjalan — minta kode 2 digit ke tamu, lalu balas (reply) pesan tiket ini dengan kode tersebut.`;
}

function guestOtpBody(otpCode: string): string {
  return `Kode verifikasi pesanan Anda: ${otpCode}. Mohon sebutkan kode ini kepada staf kami saat pesanan diterima.`;
}

function renderVerifyOutcome(result: OtpVerifyResult, attemptsLeft: number | undefined): string {
  switch (result) {
    case 'verified':
      return '✅ Kode benar — tiket ditutup. Terima kasih.';
    case 'wrong_code':
      return `❌ Kode salah — sisa ${attemptsLeft ?? 0} percobaan.`;
    case 'locked':
      return 'Kode salah 3×. Tiket ditutup tanpa verifikasi (tercatat).';
    case 'already_closed':
      return 'Tiket sudah ditutup.';
    case 'not_required':
      return 'Tiket ini tidak memerlukan kode verifikasi.';
  }
}

export class TelegramOtpCallbackService implements OtpInteractionPort {
  private readonly clock: OtpClock;

  constructor(
    private readonly deps: TelegramOtpCallbackDeps,
    private readonly logger: Logger,
    clock?: OtpClock,
  ) {
    this.clock = clock ?? SYSTEM_CLOCK;
  }

  async handleCallback(input: OtpCallbackInteraction): Promise<void> {
    const parsed = parseOtpCallbackData(input.data);
    if (parsed === null) {
      await this.answerSafely(input, ACK_TEXT.error);
      return;
    }
    this.logger.info({
      msg: 'telegram_otp.callback',
      module: LOG_MODULE,
      hotelId: input.hotelId,
      ticketId: parsed.ticketId,
      action: parsed.action,
    });

    try {
      switch (parsed.action) {
        case 'done':
          await this.handleDone(input, parsed.ticketId);
          break;
        case 'nocode':
          await this.deps.core.skip({ ticketId: parsed.ticketId, reason: 'other' });
          await this.answerSafely(input, ACK_TEXT.nocode);
          await this.postNote(input, parsed.ticketId, NOTE_NOCODE);
          break;
        case 'declined':
          await this.deps.core.skip({ ticketId: parsed.ticketId, reason: 'guest_declined' });
          await this.answerSafely(input, ACK_TEXT.declined);
          await this.postNote(input, parsed.ticketId, NOTE_DECLINED);
          break;
        case 'resend':
          await this.handleResend(input, parsed.ticketId);
          break;
      }
    } catch (err) {
      this.logger.error({
        msg: 'telegram_otp.callback_action_failed',
        module: LOG_MODULE,
        hotelId: input.hotelId,
        ticketId: parsed.ticketId,
        action: parsed.action,
        errCode: err instanceof Error ? err.name : 'unknown',
      });
      await this.answerSafely(input, ACK_TEXT.error);
    }
  }

  async handleReplyCode(input: OtpReplyCodeInteraction): Promise<void> {
    const resolved = await this.deps.core.resolveTicketByTelegramMessage({
      hotelId: input.hotelId,
      telegramMessageId: input.replyToMessageId,
    });
    if (resolved === null) {
      this.logger.info({
        msg: 'telegram_otp.reply_unresolved',
        module: LOG_MODULE,
        hotelId: input.hotelId,
      });
      return;
    }

    const { result, attemptsLeft } = await this.deps.core.verifyCode({
      ticketId: resolved.ticketId,
      code: input.code,
      actorTelegramId: input.actorTelegramId,
    });

    this.logger.info({
      msg: 'telegram_otp.verify_outcome',
      module: LOG_MODULE,
      hotelId: input.hotelId,
      ticketId: resolved.ticketId,
      result,
    });

    await this.deps.telegram.sendMessage({
      hotelId: input.hotelId,
      chatId: input.chatId,
      body: renderVerifyOutcome(result, attemptsLeft),
      replyToMessageId: input.replyToMessageId,
    });
  }

  private async handleDone(input: OtpCallbackInteraction, ticketId: string): Promise<void> {
    const { graceDeadline } = await this.deps.core.markDelivered({
      ticketId,
      actorTelegramId: input.actorTelegramId,
    });
    await this.answerSafely(input, ACK_TEXT.done);
    await this.postNote(input, ticketId, graceNote(graceDeadline, this.clock.now()));
  }

  private async handleResend(input: OtpCallbackInteraction, ticketId: string): Promise<void> {
    const outcome = await this.deps.core.resend({ ticketId });

    if (outcome.kind === 'limit_reached') {
      await this.answerSafely(input, ACK_TEXT.resend_limit);
      await this.postNote(input, ticketId, NOTE_RESEND_LIMIT);
      return;
    }
    if (outcome.kind === 'not_applicable') {
      await this.answerSafely(input, ACK_TEXT.resend_failed);
      await this.postNote(input, ticketId, NOTE_RESEND_NOT_APPLICABLE);
      return;
    }

    const context = await this.deps.repo.findByTicketId(ticketId);
    const waSend = this.deps.waSend;
    if (
      waSend === undefined ||
      context === null ||
      context.guestWaPhone === null ||
      context.guestId === null
    ) {
      this.logger.warn({
        msg: 'telegram_otp.resend_no_guest_context',
        module: LOG_MODULE,
        hotelId: input.hotelId,
        ticketId,
      });
      await this.answerSafely(input, ACK_TEXT.resend_failed);
      await this.postNote(input, ticketId, NOTE_RESEND_NO_GUEST);
      return;
    }

    const sendResult = await waSend.sendText({
      hotelId: input.hotelId,
      guestId: context.guestId,
      recipientPhone: context.guestWaPhone,
      body: guestOtpBody(outcome.otpCode),
    });

    if (!sendResult.sent) {
      await this.answerSafely(input, ACK_TEXT.resend_failed);
      await this.postNote(input, ticketId, NOTE_RESEND_SEND_FAILED);
      return;
    }

    try {
      await this.deps.core.ackDelivered({ ticketId });
    } catch (err) {
      this.logger.error({
        msg: 'telegram_otp.ack_delivered_failed',
        module: LOG_MODULE,
        hotelId: input.hotelId,
        ticketId,
        errCode: err instanceof Error ? err.name : 'unknown',
      });
    }
    await this.answerSafely(input, ACK_TEXT.resend_ok);
    await this.postNote(input, ticketId, NOTE_RESEND_OK);
  }

  private async answerSafely(input: OtpCallbackInteraction, text: string): Promise<void> {
    try {
      await this.deps.telegram.answerCallbackQuery({
        hotelId: input.hotelId,
        callbackQueryId: input.callbackQueryId,
        text,
      });
    } catch (err) {
      this.logger.warn({
        msg: 'telegram_otp.answer_callback_failed',
        module: LOG_MODULE,
        hotelId: input.hotelId,
        errCode: err instanceof Error ? err.name : 'unknown',
      });
    }
  }

  /** Posts a short group note threaded onto the ticket message. Falls back
   *  to the persisted context when the callback lacked `message`. */
  private async postNote(
    input: OtpCallbackInteraction,
    ticketId: string,
    body: string,
  ): Promise<void> {
    let chatId = input.chatId;
    let messageId = input.messageId;
    if (chatId === null || messageId === null) {
      const context = await this.deps.repo.findByTicketId(ticketId);
      if (context === null) {
        this.logger.warn({
          msg: 'telegram_otp.note_skipped_no_target',
          module: LOG_MODULE,
          hotelId: input.hotelId,
          ticketId,
        });
        return;
      }
      chatId = context.chatId;
      messageId = context.telegramMessageId;
    }
    try {
      await this.deps.telegram.sendMessage({
        hotelId: input.hotelId,
        chatId,
        body,
        replyToMessageId: messageId,
      });
    } catch (err) {
      this.logger.error({
        msg: 'telegram_otp.note_post_failed',
        module: LOG_MODULE,
        hotelId: input.hotelId,
        ticketId,
        errCode: err instanceof Error ? err.name : 'unknown',
      });
    }
  }
}
