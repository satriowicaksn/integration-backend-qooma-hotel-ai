/**
 * Route-level unit test for T97 POST /internal/telegram/dispatch.
 * fastify.inject with fully-mocked dispatch service + OTP notifier.
 *
 * Verifies:
 *  - guard rejection propagates (401) before any service call
 *  - backward-compatible plain dispatch (no requires_otp) → sendMessage
 *  - requires_otp:true routes through the OTP notifier with mapped input
 *  - requires_otp without ticket_id → 400
 *  - `.strict()` anti-cheat: an `otp_code` field is rejected outright
 */

import { describe, expect, it, jest } from '@jest/globals';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

import { AuthError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { registerErrorHandler } from '@plugins/error-handler.plugin.js';

import { telegramOutboundRoutes } from '../telegram-outbound.routes.js';
import type { TelegramDispatchService } from '../telegram-outbound.service.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const TICKET_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const SENT_AT = new Date('2026-07-22T09:00:00Z');

const basePayload = {
  hotel_id: HOTEL_ID,
  chat_id: '-1001234567890',
  body: 'Tiket #T-0042 — Extra towel — Kamar 1208',
};

function createLogger(): Logger {
  return { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

interface Doubles {
  sendMessage: jest.Mock;
  notifyTicket: jest.Mock;
}

async function buildTestApp(opts?: { guardRejects?: boolean }): Promise<{
  app: FastifyInstance;
  doubles: Doubles;
}> {
  const sendMessage = jest
    .fn()
    .mockReturnValue(Promise.resolve({ messageId: '4242', sentAt: SENT_AT }));
  const notifyTicket = jest
    .fn()
    .mockReturnValue(Promise.resolve({ messageId: '4243', sentAt: SENT_AT }));

  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  const guard = (_req: FastifyRequest, _reply: unknown, done: (err?: Error) => void): void => {
    if (opts?.guardRejects === true) {
      done(new AuthError('bad secret'));
      return;
    }
    done();
  };
  await app.register(telegramOutboundRoutes, {
    dispatchService: { sendMessage } as unknown as TelegramDispatchService,
    otpNotifier: { notifyTicket } as never,
    guards: [guard],
    logger: createLogger(),
  });
  await app.ready();
  return { app, doubles: { sendMessage, notifyTicket } };
}

describe('POST /internal/telegram/dispatch', () => {
  it('should return 401 from the guard before any service call', async () => {
    const { app, doubles } = await buildTestApp({ guardRejects: true });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/telegram/dispatch',
        payload: basePayload,
      });
      expect(res.statusCode).toBe(401);
      expect(doubles.sendMessage).not.toHaveBeenCalled();
      expect(doubles.notifyTicket).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should dispatch plainly (backward compatible) when requires_otp is absent', async () => {
    const { app, doubles } = await buildTestApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/telegram/dispatch',
        payload: { ...basePayload, parse_mode: 'HTML' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ message_id: '4242', sent_at: SENT_AT.toISOString() });
      expect(doubles.sendMessage).toHaveBeenCalledWith({
        hotelId: HOTEL_ID,
        chatId: basePayload.chat_id,
        body: basePayload.body,
        parseMode: 'HTML',
      });
      expect(doubles.notifyTicket).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should route requires_otp dispatches through the OTP notifier with mapped input', async () => {
    const { app, doubles } = await buildTestApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/telegram/dispatch',
        payload: {
          ...basePayload,
          requires_otp: true,
          ticket_id: TICKET_ID,
          guest_wa_phone: '+6281234567890',
          guest_id: '22222222-3333-4444-5555-666666666666',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ message_id: '4243', sent_at: SENT_AT.toISOString() });
      expect(doubles.notifyTicket).toHaveBeenCalledWith({
        hotelId: HOTEL_ID,
        chatId: basePayload.chat_id,
        body: basePayload.body,
        ticketId: TICKET_ID,
        guestWaPhone: '+6281234567890',
        guestId: '22222222-3333-4444-5555-666666666666',
      });
      expect(doubles.sendMessage).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should 400 when requires_otp is true without ticket_id', async () => {
    const { app, doubles } = await buildTestApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/telegram/dispatch',
        payload: { ...basePayload, requires_otp: true },
      });
      expect(res.statusCode).toBe(400);
      expect(doubles.notifyTicket).not.toHaveBeenCalled();
      expect(doubles.sendMessage).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('should 400 on any unknown field — an otp_code can never enter this payload', async () => {
    const { app, doubles } = await buildTestApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/internal/telegram/dispatch',
        payload: { ...basePayload, requires_otp: true, ticket_id: TICKET_ID, otp_code: '37' },
      });
      expect(res.statusCode).toBe(400);
      expect(doubles.notifyTicket).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
