/**
 * T97 (ADD-24) inbound routing tests — callback_query parsing + routing,
 * reply-code detection (whitespace tolerated, non-reply ignored), webhook
 * retry dedup, and regression: the /take /release /done command path is
 * untouched by the OTP additions.
 */

import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import type { OtpInteractionPort } from '../ports/otp-interaction.port.js';
import type { StaffLookupPort } from '../ports/staff-lookup.port.js';
import type { TicketActionPort } from '../ports/ticket-action.port.js';
import { TelegramUpdateSchema } from '../telegram-inbound.schema.js';
import { TelegramInboundService } from '../telegram-inbound.service.js';
import type { StaffIdentity } from '../telegram-inbound.types.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const TICKET_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const STAFF: StaffIdentity = {
  staffId: 'staff-1',
  hotelId: HOTEL_ID,
  deptId: 'dept-1',
  role: 'staff',
};

function createLogger(): Logger {
  return { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

interface Harness {
  service: TelegramInboundService;
  staffLookup: jest.Mock;
  take: jest.Mock;
  otp: { handleCallback: jest.Mock; handleReplyCode: jest.Mock };
}

function buildHarness(opts?: { withOtp?: boolean; staff?: StaffIdentity | null }): Harness {
  const staffLookup = jest
    .fn<StaffLookupPort['lookupByTelegramUserId']>()
    .mockResolvedValue(opts?.staff ?? null);
  const take = jest.fn<TicketActionPort['take']>().mockResolvedValue({ status: 'ok' });
  const otp = {
    handleCallback: jest.fn<OtpInteractionPort['handleCallback']>().mockResolvedValue(undefined),
    handleReplyCode: jest.fn<OtpInteractionPort['handleReplyCode']>().mockResolvedValue(undefined),
  };
  const service = new TelegramInboundService(
    { lookupByTelegramUserId: staffLookup },
    {
      take,
      release: jest.fn<TicketActionPort['release']>().mockResolvedValue({ status: 'ok' }),
      markDone: jest.fn<TicketActionPort['markDone']>().mockResolvedValue({ status: 'ok' }),
    },
    createLogger(),
    opts?.withOtp === false ? undefined : otp,
  );
  return { service, staffLookup, take, otp };
}

function callbackUpdate(overrides?: {
  data?: string;
  callbackId?: string;
  withMessage?: boolean;
}): Record<string, unknown> {
  return {
    update_id: 100,
    callback_query: {
      id: overrides?.callbackId ?? 'cbq-1',
      from: { id: 777 },
      ...(overrides?.withMessage === false
        ? {}
        : { message: { message_id: 4242, chat: { id: -1001234567890 } } }),
      data: overrides?.data ?? `otp:done:${TICKET_ID}`,
    },
  };
}

function replyCodeUpdate(overrides?: {
  updateId?: number;
  text?: string;
  withReply?: boolean;
}): Record<string, unknown> {
  return {
    update_id: overrides?.updateId ?? 200,
    message: {
      message_id: 5001,
      date: 1_753_170_000,
      chat: { id: -1001234567890 },
      from: { id: 777 },
      text: overrides?.text ?? '42',
      ...(overrides?.withReply === false ? {} : { reply_to_message: { message_id: 4242 } }),
    },
  };
}

function parse(update: Record<string, unknown>): ReturnType<typeof TelegramUpdateSchema.parse> {
  return TelegramUpdateSchema.parse(update);
}

describe('TelegramUpdateSchema — T97 extensions', () => {
  it('should parse callback_query with id, from, message and data', () => {
    const parsed = parse(callbackUpdate());
    expect(parsed.callback_query?.id).toBe('cbq-1');
    expect(parsed.callback_query?.from.id).toBe(777);
    expect(parsed.callback_query?.message?.message_id).toBe(4242);
    expect(parsed.callback_query?.data).toBe(`otp:done:${TICKET_ID}`);
  });

  it('should parse reply_to_message.message_id on messages', () => {
    const parsed = parse(replyCodeUpdate());
    expect(parsed.message?.reply_to_message?.message_id).toBe(4242);
  });
});

describe('handleUpdate — otp callback routing', () => {
  it('should route otp:* callbacks to the OTP port with actor + chat + message context', async () => {
    const { service, otp } = buildHarness();

    const result = await service.handleUpdate(HOTEL_ID, parse(callbackUpdate()));

    expect(result).toEqual({ kind: 'handled', via: 'otp_callback' });
    expect(otp.handleCallback).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      callbackQueryId: 'cbq-1',
      data: `otp:done:${TICKET_ID}`,
      actorTelegramId: '777',
      chatId: '-1001234567890',
      messageId: 4242,
    });
  });

  it('should pass null chat/message context when Telegram omits callback message', async () => {
    const { service, otp } = buildHarness();

    await service.handleUpdate(HOTEL_ID, parse(callbackUpdate({ withMessage: false })));

    expect(otp.handleCallback).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: null, messageId: null }),
    );
  });

  it('should ignore duplicate callback ids (Telegram webhook retry)', async () => {
    const { service, otp } = buildHarness();

    const first = await service.handleUpdate(HOTEL_ID, parse(callbackUpdate()));
    const second = await service.handleUpdate(HOTEL_ID, parse(callbackUpdate()));

    expect(first.kind).toBe('handled');
    expect(second).toEqual({ kind: 'ignored', reason: 'duplicate_update' });
    expect(otp.handleCallback).toHaveBeenCalledTimes(1);
  });

  it('should ignore non-otp callback data', async () => {
    const { service, otp } = buildHarness();
    const result = await service.handleUpdate(
      HOTEL_ID,
      parse(callbackUpdate({ data: 'vote:yes' })),
    );
    expect(result).toEqual({ kind: 'ignored', reason: 'callback_unsupported' });
    expect(otp.handleCallback).not.toHaveBeenCalled();
  });

  it('should ignore callbacks when no OTP port is wired', async () => {
    const { service } = buildHarness({ withOtp: false });
    const result = await service.handleUpdate(HOTEL_ID, parse(callbackUpdate()));
    expect(result).toEqual({ kind: 'ignored', reason: 'otp_not_configured' });
  });

  it('should swallow OTP port failures (webhook already acked)', async () => {
    const { service, otp } = buildHarness();
    otp.handleCallback.mockRejectedValue(new Error('core down'));
    const result = await service.handleUpdate(HOTEL_ID, parse(callbackUpdate()));
    expect(result).toEqual({ kind: 'handled', via: 'otp_callback' });
  });
});

describe('handleUpdate — reply-code verification routing', () => {
  it('should route a 2-digit reply to the OTP port', async () => {
    const { service, otp, staffLookup } = buildHarness();

    const result = await service.handleUpdate(HOTEL_ID, parse(replyCodeUpdate()));

    expect(result).toEqual({ kind: 'handled', via: 'otp_reply_verify' });
    expect(otp.handleReplyCode).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      chatId: '-1001234567890',
      replyToMessageId: 4242,
      code: '42',
      actorTelegramId: '777',
    });
    expect(staffLookup).not.toHaveBeenCalled();
  });

  it('should tolerate surrounding whitespace in the code text', async () => {
    const { service, otp } = buildHarness();

    await service.handleUpdate(HOTEL_ID, parse(replyCodeUpdate({ text: '  42  ' })));

    expect(otp.handleReplyCode).toHaveBeenCalledWith(expect.objectContaining({ code: '42' }));
  });

  it('should NOT trigger verification for a non-reply 2-digit message', async () => {
    const { service, otp, staffLookup } = buildHarness();

    const result = await service.handleUpdate(
      HOTEL_ID,
      parse(replyCodeUpdate({ withReply: false })),
    );

    expect(otp.handleReplyCode).not.toHaveBeenCalled();
    expect(staffLookup).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'ignored', reason: 'staff_not_recognized' });
  });

  it('should NOT trigger verification for replies that are not exactly 2 digits', async () => {
    const { service, otp } = buildHarness();

    await service.handleUpdate(HOTEL_ID, parse(replyCodeUpdate({ text: '421' })));
    await service.handleUpdate(HOTEL_ID, parse(replyCodeUpdate({ text: 'kode 42' })));

    expect(otp.handleReplyCode).not.toHaveBeenCalled();
  });

  it('should dedupe retried reply-code updates by update_id', async () => {
    const { service, otp } = buildHarness();

    await service.handleUpdate(HOTEL_ID, parse(replyCodeUpdate({ updateId: 300 })));
    const retry = await service.handleUpdate(HOTEL_ID, parse(replyCodeUpdate({ updateId: 300 })));

    expect(retry).toEqual({ kind: 'ignored', reason: 'duplicate_update' });
    expect(otp.handleReplyCode).toHaveBeenCalledTimes(1);
  });
});

describe('handleUpdate — legacy command path regression', () => {
  it('should keep /take working for recognized staff even when a reply is attached', async () => {
    const { service, take, otp } = buildHarness({ staff: STAFF });

    const result = await service.handleUpdate(
      HOTEL_ID,
      parse(replyCodeUpdate({ text: '/take T-1' })),
    );

    expect(otp.handleReplyCode).not.toHaveBeenCalled();
    expect(take).toHaveBeenCalledWith({ hotelId: HOTEL_ID, ticketId: 'T-1', staffId: 'staff-1' });
    expect(result).toEqual({ kind: 'reply', text: 'Ticket T-1 assigned to you.' });
  });
});
