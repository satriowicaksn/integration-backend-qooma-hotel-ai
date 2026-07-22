/**
 * Unit tests for TelegramOtpCallbackService — the 4 button actions + reply
 * verification. The overarching anti-cheat assertion: the OTP code value
 * NEVER appears in any Telegram payload or log line; it may ONLY appear in
 * the guest WA body.
 */

import { describe, expect, it, jest } from '@jest/globals';

import type { OtpCallbackInteraction } from '@modules/telegram/index.js';

import type { GuestWaSendPort } from '../ports/guest-wa-send.port.js';
import type { HotelCoreOtpPort } from '../ports/hotel-core-otp.port.js';
import type { TelegramSendPort } from '../ports/telegram-send.port.js';
import { TelegramOtpCallbackService } from '../telegram-otp-callback.service.js';
import type { OtpTicketContextRepository } from '../telegram-otp.repository.js';
import type { OtpTicketContext } from '../telegram-otp.types.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const TICKET_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const GUEST_ID = '22222222-3333-4444-5555-666666666666';
const CHAT_ID = '-1001234567890';
const MESSAGE_ID = 4242;
const OTP_CODE = '37';
const NOW = new Date('2026-07-22T09:00:00Z');

const CONTEXT: OtpTicketContext = {
  ticketId: TICKET_ID,
  hotelId: HOTEL_ID,
  chatId: CHAT_ID,
  telegramMessageId: MESSAGE_ID,
  guestWaPhone: '+6281234567890',
  guestId: GUEST_ID,
};

function callbackInput(action: string): OtpCallbackInteraction {
  return {
    hotelId: HOTEL_ID,
    callbackQueryId: 'cbq-1',
    data: `otp:${action}:${TICKET_ID}`,
    actorTelegramId: '777',
    chatId: CHAT_ID,
    messageId: MESSAGE_ID,
  };
}

interface CoreMock {
  resolveTicketByTelegramMessage: jest.Mock<HotelCoreOtpPort['resolveTicketByTelegramMessage']>;
  storeTelegramMessage: jest.Mock<HotelCoreOtpPort['storeTelegramMessage']>;
  ackDelivered: jest.Mock<HotelCoreOtpPort['ackDelivered']>;
  markDelivered: jest.Mock<HotelCoreOtpPort['markDelivered']>;
  verifyCode: jest.Mock<HotelCoreOtpPort['verifyCode']>;
  skip: jest.Mock<HotelCoreOtpPort['skip']>;
  resend: jest.Mock<HotelCoreOtpPort['resend']>;
}

interface Harness {
  service: TelegramOtpCallbackService;
  core: CoreMock;
  sendMessage: jest.Mock;
  answerCallbackQuery: jest.Mock;
  waSendText: jest.Mock;
  findByTicketId: jest.Mock;
  logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };
  allTelegramPayloads: () => string;
  allLogLines: () => string;
}

function buildHarness(opts?: { context?: OtpTicketContext | null; withWaSend?: boolean }): Harness {
  const core: CoreMock = {
    resolveTicketByTelegramMessage: jest.fn<HotelCoreOtpPort['resolveTicketByTelegramMessage']>(),
    storeTelegramMessage: jest.fn<HotelCoreOtpPort['storeTelegramMessage']>(),
    ackDelivered: jest.fn<HotelCoreOtpPort['ackDelivered']>().mockResolvedValue(undefined),
    markDelivered: jest.fn<HotelCoreOtpPort['markDelivered']>(),
    verifyCode: jest.fn<HotelCoreOtpPort['verifyCode']>(),
    skip: jest.fn<HotelCoreOtpPort['skip']>().mockResolvedValue(undefined),
    resend: jest.fn<HotelCoreOtpPort['resend']>(),
  };

  const sendMessage = jest
    .fn<TelegramSendPort['sendMessage']>()
    .mockResolvedValue({ messageId: '9999', sentAt: NOW });
  const answerCallbackQuery = jest
    .fn<TelegramSendPort['answerCallbackQuery']>()
    .mockResolvedValue(undefined);
  const waSendText = jest.fn<GuestWaSendPort['sendText']>().mockResolvedValue({ sent: true });
  const findByTicketId = jest
    .fn<OtpTicketContextRepository['findByTicketId']>()
    .mockResolvedValue(opts?.context === undefined ? CONTEXT : opts.context);
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const service = new TelegramOtpCallbackService(
    {
      core: core as unknown as HotelCoreOtpPort,
      telegram: { sendMessage, answerCallbackQuery } as unknown as TelegramSendPort,
      repo: { findByTicketId } as unknown as OtpTicketContextRepository,
      ...(opts?.withWaSend === false ? {} : { waSend: { sendText: waSendText } }),
    },
    logger,
    { now: () => NOW },
  );

  return {
    service,
    core,
    sendMessage,
    answerCallbackQuery,
    waSendText,
    findByTicketId,
    logger,
    allTelegramPayloads: () =>
      JSON.stringify([...sendMessage.mock.calls, ...answerCallbackQuery.mock.calls]),
    allLogLines: () =>
      JSON.stringify([
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ]),
  };
}

describe('handleCallback — done', () => {
  it('should mark delivered, ack the press, and post a grace note derived from the deadline', async () => {
    const h = buildHarness();
    // 7 minutes from NOW — proves the copy is NOT a hardcoded "10".
    h.core.markDelivered.mockResolvedValue({
      graceDeadline: new Date(NOW.getTime() + 7 * 60_000),
    });

    await h.service.handleCallback(callbackInput('done'));

    expect(h.core.markDelivered).toHaveBeenCalledWith({
      ticketId: TICKET_ID,
      actorTelegramId: '777',
    });
    expect(h.answerCallbackQuery).toHaveBeenCalledTimes(1);
    const note = h.sendMessage.mock.calls[0]?.[0] as { body: string; replyToMessageId: number };
    expect(note.body).toContain('Grace ±7 menit');
    expect(note.body).toContain('reply');
    expect(note.replyToMessageId).toBe(MESSAGE_ID);
  });
});

describe('handleCallback — nocode / declined', () => {
  it('should skip with reason other for [Selesai tanpa kode]', async () => {
    const h = buildHarness();
    await h.service.handleCallback(callbackInput('nocode'));
    expect(h.core.skip).toHaveBeenCalledWith({ ticketId: TICKET_ID, reason: 'other' });
    const note = h.sendMessage.mock.calls[0]?.[0] as { body: string };
    expect(note.body).toBe('Tiket ditutup tanpa verifikasi kode.');
  });

  it('should skip with reason guest_declined for [Tamu tidak mau kode]', async () => {
    const h = buildHarness();
    await h.service.handleCallback(callbackInput('declined'));
    expect(h.core.skip).toHaveBeenCalledWith({ ticketId: TICKET_ID, reason: 'guest_declined' });
  });
});

describe('handleCallback — resend', () => {
  it('happy path: WA body carries the code; Telegram + logs NEVER do; Core gets ack-delivered', async () => {
    const h = buildHarness();
    h.core.resend.mockResolvedValue({ kind: 'ok', otpCode: OTP_CODE });

    await h.service.handleCallback(callbackInput('resend'));

    expect(h.waSendText).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      guestId: GUEST_ID,
      recipientPhone: CONTEXT.guestWaPhone,
      body: expect.stringContaining(OTP_CODE) as unknown as string,
    });
    expect(h.core.ackDelivered).toHaveBeenCalledWith({ ticketId: TICKET_ID });
    expect(h.allTelegramPayloads()).not.toContain(OTP_CODE);
    expect(h.allLogLines()).not.toContain(OTP_CODE);
  });

  it('limit reached: friendly group note, NO WA send, NO code anywhere', async () => {
    const h = buildHarness();
    h.core.resend.mockResolvedValue({ kind: 'limit_reached' });

    await h.service.handleCallback(callbackInput('resend'));

    expect(h.waSendText).not.toHaveBeenCalled();
    expect(h.core.ackDelivered).not.toHaveBeenCalled();
    const note = h.sendMessage.mock.calls[0]?.[0] as { body: string };
    expect(note.body).toContain('Batas kirim ulang');
  });

  it('missing guest context: warns + posts a fallback note, never sends WA', async () => {
    const h = buildHarness({ context: { ...CONTEXT, guestWaPhone: null, guestId: null } });
    h.core.resend.mockResolvedValue({ kind: 'ok', otpCode: OTP_CODE });

    await h.service.handleCallback(callbackInput('resend'));

    expect(h.waSendText).not.toHaveBeenCalled();
    expect(h.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'telegram_otp.resend_no_guest_context' }),
    );
    expect(h.allTelegramPayloads()).not.toContain(OTP_CODE);
    expect(h.allLogLines()).not.toContain(OTP_CODE);
  });

  it('WA dispatch failure: failure note, ack-delivered NOT called', async () => {
    const h = buildHarness();
    h.core.resend.mockResolvedValue({ kind: 'ok', otpCode: OTP_CODE });
    h.waSendText.mockResolvedValue({ sent: false });

    await h.service.handleCallback(callbackInput('resend'));

    expect(h.core.ackDelivered).not.toHaveBeenCalled();
    const note = h.sendMessage.mock.calls[0]?.[0] as { body: string };
    expect(note.body).toContain('Gagal mengirim ulang');
    expect(h.allTelegramPayloads()).not.toContain(OTP_CODE);
  });
});

describe('handleCallback — resilience', () => {
  it('should answer with a generic error when Core throws (no crash, no code)', async () => {
    const h = buildHarness();
    h.core.markDelivered.mockRejectedValue(new Error('boom'));

    await h.service.handleCallback(callbackInput('done'));

    expect(h.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Terjadi kesalahan. Coba lagi.' }),
    );
    expect(h.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'telegram_otp.callback_action_failed' }),
    );
  });
});

describe('handleReplyCode', () => {
  const replyInput = {
    hotelId: HOTEL_ID,
    chatId: CHAT_ID,
    replyToMessageId: MESSAGE_ID,
    code: OTP_CODE,
    actorTelegramId: '777',
  };

  it('should silently ignore replies to non-ticket messages', async () => {
    const h = buildHarness();
    h.core.resolveTicketByTelegramMessage.mockResolvedValue(null);

    await h.service.handleReplyCode(replyInput);

    expect(h.core.verifyCode).not.toHaveBeenCalled();
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it.each([
    ['verified', undefined, '✅ Kode benar — tiket ditutup. Terima kasih.'],
    ['wrong_code', 2, '❌ Kode salah — sisa 2 percobaan.'],
    ['locked', undefined, 'Kode salah 3×. Tiket ditutup tanpa verifikasi (tercatat).'],
    ['already_closed', undefined, 'Tiket sudah ditutup.'],
    ['not_required', undefined, 'Tiket ini tidak memerlukan kode verifikasi.'],
  ] as const)('should render %s as a reply to the ticket message', async (result, left, text) => {
    const h = buildHarness();
    h.core.resolveTicketByTelegramMessage.mockResolvedValue({ ticketId: TICKET_ID });
    h.core.verifyCode.mockResolvedValue({
      result,
      ...(left !== undefined ? { attemptsLeft: left } : {}),
    });

    await h.service.handleReplyCode(replyInput);

    expect(h.core.verifyCode).toHaveBeenCalledWith({
      ticketId: TICKET_ID,
      code: OTP_CODE,
      actorTelegramId: '777',
    });
    expect(h.sendMessage).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      chatId: CHAT_ID,
      body: text,
      replyToMessageId: MESSAGE_ID,
    });
  });

  it('should never echo the attempted code into Telegram or logs', async () => {
    const h = buildHarness();
    h.core.resolveTicketByTelegramMessage.mockResolvedValue({ ticketId: TICKET_ID });
    h.core.verifyCode.mockResolvedValue({ result: 'wrong_code', attemptsLeft: 1 });

    await h.service.handleReplyCode(replyInput);

    expect(h.allTelegramPayloads()).not.toContain(OTP_CODE);
    expect(h.allLogLines()).not.toContain(OTP_CODE);
  });
});
