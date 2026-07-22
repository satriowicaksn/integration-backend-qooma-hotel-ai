/**
 * Unit tests for HotelCoreOtpAdapter — mocks axios (no real HTTP).
 * Verifies request shapes (snake_case bodies, X-Internal-Secret header,
 * URL paths), outcome mapping (404 → null, 409 → limit/not-applicable),
 * and the anti-cheat logging discipline (the code NEVER hits a log line).
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

import { ExternalServiceError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { HotelCoreOtpAdapter } from '../adapters/hotel-core-otp.adapter.js';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const CONFIG = {
  baseUrl: 'http://core.local:4000',
  internalSecret: 'internal-secret-at-least-32-chars-long-x',
};
const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const TICKET_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const OTP_CODE = '37';

type LoggerSpy = Logger & { info: jest.Mock; warn: jest.Mock; error: jest.Mock };

function createLoggerSpy(): LoggerSpy {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as LoggerSpy;
}

describe('HotelCoreOtpAdapter', () => {
  let postMock: jest.MockedFunction<AxiosInstance['post']>;
  let logger: LoggerSpy;
  let adapter: HotelCoreOtpAdapter;

  beforeEach(() => {
    postMock = jest.fn();
    mockedAxios.create.mockReturnValue({ post: postMock } as unknown as AxiosInstance);
    logger = createLoggerSpy();
    adapter = new HotelCoreOtpAdapter(CONFIG, logger);
  });

  function lastCall(): { url: string; body: unknown; headers: Record<string, string> } {
    const call = postMock.mock.calls[0] as unknown as [
      string,
      unknown,
      { headers: Record<string, string> },
    ];
    return { url: call[0], body: call[1], headers: call[2].headers };
  }

  describe('resolveTicketByTelegramMessage', () => {
    it('should POST snake_case body with the internal secret header', async () => {
      postMock.mockResolvedValueOnce({ status: 200, data: { ticket_id: TICKET_ID } });

      const result = await adapter.resolveTicketByTelegramMessage({
        hotelId: HOTEL_ID,
        telegramMessageId: 4242,
      });

      const { url, body, headers } = lastCall();
      expect(url).toBe('http://core.local:4000/internal/tickets/resolve-telegram');
      expect(body).toEqual({ hotel_id: HOTEL_ID, telegram_message_id: 4242 });
      expect(headers['x-internal-secret']).toBe(CONFIG.internalSecret);
      expect(result).toEqual({ ticketId: TICKET_ID });
    });

    it('should map 404 to null', async () => {
      postMock.mockResolvedValueOnce({ status: 404, data: {} });
      await expect(
        adapter.resolveTicketByTelegramMessage({ hotelId: HOTEL_ID, telegramMessageId: 1 }),
      ).resolves.toBeNull();
    });
  });

  it('storeTelegramMessage should hit /internal/tickets/:id/telegram-message', async () => {
    postMock.mockResolvedValueOnce({ status: 200, data: { ok: true } });

    await adapter.storeTelegramMessage({ ticketId: TICKET_ID, telegramMessageId: 4242 });

    const { url, body } = lastCall();
    expect(url).toBe(`http://core.local:4000/internal/tickets/${TICKET_ID}/telegram-message`);
    expect(body).toEqual({ telegram_message_id: 4242 });
  });

  it('markDelivered should send actor_telegram_id and parse grace_deadline', async () => {
    const deadline = '2026-07-22T10:10:00.000Z';
    postMock.mockResolvedValueOnce({ status: 200, data: { grace_deadline: deadline } });

    const result = await adapter.markDelivered({ ticketId: TICKET_ID, actorTelegramId: '777' });

    const { url, body } = lastCall();
    expect(url).toBe(`http://core.local:4000/internal/tickets/${TICKET_ID}/otp/mark-delivered`);
    expect(body).toEqual({ actor_telegram_id: '777' });
    expect(result.graceDeadline.toISOString()).toBe(deadline);
  });

  describe('verifyCode', () => {
    it('should POST the code + actor and map attempts_left', async () => {
      postMock.mockResolvedValueOnce({
        status: 200,
        data: { result: 'wrong_code', attempts_left: 2 },
      });

      const result = await adapter.verifyCode({
        ticketId: TICKET_ID,
        code: OTP_CODE,
        actorTelegramId: '777',
      });

      const { url, body } = lastCall();
      expect(url).toBe(`http://core.local:4000/internal/tickets/${TICKET_ID}/otp/verify`);
      expect(body).toEqual({ code: OTP_CODE, actor_telegram_id: '777' });
      expect(result).toEqual({ result: 'wrong_code', attemptsLeft: 2 });
    });

    it('should never write the attempted code to a log line', async () => {
      postMock.mockResolvedValueOnce({ status: 200, data: { result: 'verified' } });

      await adapter.verifyCode({ ticketId: TICKET_ID, code: OTP_CODE });

      const allLogged = JSON.stringify([
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ]);
      expect(allLogged).not.toContain(OTP_CODE);
    });

    it('should throw ExternalServiceError on unknown result values', async () => {
      postMock.mockResolvedValueOnce({ status: 200, data: { result: 'maybe' } });
      await expect(adapter.verifyCode({ ticketId: TICKET_ID, code: OTP_CODE })).rejects.toThrow(
        ExternalServiceError,
      );
    });
  });

  it('skip should POST reason + optional note', async () => {
    postMock.mockResolvedValueOnce({ status: 200, data: { ok: true } });

    await adapter.skip({ ticketId: TICKET_ID, reason: 'guest_declined' });

    const { url, body } = lastCall();
    expect(url).toBe(`http://core.local:4000/internal/tickets/${TICKET_ID}/otp/skip`);
    expect(body).toEqual({ reason: 'guest_declined' });
  });

  describe('resend', () => {
    it('should return the code on 2xx WITHOUT logging it', async () => {
      postMock.mockResolvedValueOnce({ status: 200, data: { otp_code: OTP_CODE } });

      const outcome = await adapter.resend({ ticketId: TICKET_ID });

      expect(outcome).toEqual({ kind: 'ok', otpCode: OTP_CODE });
      const allLogged = JSON.stringify([
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ]);
      expect(allLogged).not.toContain(OTP_CODE);
    });

    it('should map 409 OTP_RESEND_LIMIT to limit_reached', async () => {
      postMock.mockResolvedValueOnce({
        status: 409,
        data: { error: { code: 'CONFLICT', details: { reason: 'OTP_RESEND_LIMIT' } } },
      });
      await expect(adapter.resend({ ticketId: TICKET_ID })).resolves.toEqual({
        kind: 'limit_reached',
      });
    });

    it('should map other 409s to not_applicable', async () => {
      postMock.mockResolvedValueOnce({
        status: 409,
        data: { error: { code: 'CONFLICT', message: 'OTP resend not applicable' } },
      });
      await expect(adapter.resend({ ticketId: TICKET_ID })).resolves.toEqual({
        kind: 'not_applicable',
      });
    });

    it('should throw ExternalServiceError on 5xx', async () => {
      postMock.mockResolvedValueOnce({ status: 503, data: {} });
      await expect(adapter.resend({ ticketId: TICKET_ID })).rejects.toThrow(ExternalServiceError);
    });
  });
});
