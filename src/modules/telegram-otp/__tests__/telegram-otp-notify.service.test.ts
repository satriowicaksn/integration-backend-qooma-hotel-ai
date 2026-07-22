import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import type { HotelCoreOtpPort } from '../ports/hotel-core-otp.port.js';
import type { TelegramSendPort } from '../ports/telegram-send.port.js';
import { TelegramOtpNotifyService } from '../telegram-otp-notify.service.js';
import type { OtpTicketContextRepository } from '../telegram-otp.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const TICKET_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const CHAT_ID = '-1001234567890';
const SENT_AT = new Date('2026-07-22T09:00:00Z');

const BASE_INPUT = {
  hotelId: HOTEL_ID,
  chatId: CHAT_ID,
  body: 'Tiket #T-0042 — Extra towel — Kamar 1208',
  ticketId: TICKET_ID,
  guestWaPhone: '+6281234567890',
  guestId: '22222222-3333-4444-5555-666666666666',
};

interface Harness {
  service: TelegramOtpNotifyService;
  sendMessage: jest.Mock;
  storeTelegramMessage: jest.Mock;
  upsert: jest.Mock;
  logger: Logger & { error: jest.Mock };
}

function buildHarness(overrides?: { storeRejects?: boolean; messageId?: string }): Harness {
  const sendMessage = jest.fn<TelegramSendPort['sendMessage']>().mockResolvedValue({
    messageId: overrides?.messageId ?? '4242',
    sentAt: SENT_AT,
  });
  const storeTelegramMessage = jest.fn<HotelCoreOtpPort['storeTelegramMessage']>();
  if (overrides?.storeRejects === true) {
    storeTelegramMessage.mockRejectedValue(new Error('core down'));
  } else {
    storeTelegramMessage.mockResolvedValue(undefined);
  }
  const upsert = jest.fn<OtpTicketContextRepository['upsert']>().mockResolvedValue(undefined);
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const service = new TelegramOtpNotifyService(
    {
      core: { storeTelegramMessage } as unknown as HotelCoreOtpPort,
      telegram: { sendMessage, answerCallbackQuery: jest.fn() } as unknown as TelegramSendPort,
      repo: { upsert } as unknown as OtpTicketContextRepository,
    },
    logger,
  );
  return { service, sendMessage, storeTelegramMessage, upsert, logger };
}

describe('TelegramOtpNotifyService.notifyTicket', () => {
  it('should send the group message with the 4-button keyboard and NO code-bearing field', async () => {
    const { service, sendMessage } = buildHarness();

    await service.notifyTicket(BASE_INPUT);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const arg = sendMessage.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(arg).sort()).toEqual(['body', 'chatId', 'hotelId', 'replyMarkup']);
    expect(arg['body']).toBe(BASE_INPUT.body);
    const markup = arg['replyMarkup'] as {
      inline_keyboard: Array<Array<{ callback_data: string }>>;
    };
    const datas = markup.inline_keyboard.flat().map((b) => b.callback_data);
    expect(datas).toHaveLength(4);
    for (const data of datas) {
      expect(data).toMatch(new RegExp(`^otp:(done|nocode|declined|resend):${TICKET_ID}$`));
    }
  });

  it('should register the posted message_id with Core and persist the resend context', async () => {
    const { service, storeTelegramMessage, upsert } = buildHarness();

    const result = await service.notifyTicket(BASE_INPUT);

    expect(result).toEqual({ messageId: '4242', sentAt: SENT_AT });
    expect(storeTelegramMessage).toHaveBeenCalledWith({
      ticketId: TICKET_ID,
      telegramMessageId: 4242,
    });
    expect(upsert).toHaveBeenCalledWith({
      ticketId: TICKET_ID,
      hotelId: HOTEL_ID,
      chatId: CHAT_ID,
      telegramMessageId: 4242,
      guestWaPhone: BASE_INPUT.guestWaPhone,
      guestId: BASE_INPUT.guestId,
    });
  });

  it('should still return the dispatch result when the Core mapping RPC fails (logged)', async () => {
    const { service, upsert, logger } = buildHarness({ storeRejects: true });

    const result = await service.notifyTicket(BASE_INPUT);

    expect(result.messageId).toBe('4242');
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'telegram_otp.store_mapping_failed' }),
    );
  });

  it('should skip mapping + context (and log) when Telegram returns a non-numeric message id', async () => {
    const { service, storeTelegramMessage, upsert, logger } = buildHarness({
      messageId: 'not-a-number',
    });

    await service.notifyTicket(BASE_INPUT);

    expect(storeTelegramMessage).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'telegram_otp.non_numeric_message_id' }),
    );
  });
});
