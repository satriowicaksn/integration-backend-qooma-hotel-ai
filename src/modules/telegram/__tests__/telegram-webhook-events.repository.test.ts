import { describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';

import { TelegramWebhookEventsRepository } from '../telegram-webhook-events.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

interface CreateMock {
  create: jest.Mock;
}

interface DbMock {
  webhookEvent: CreateMock;
}

function buildDb(): DbMock {
  return { webhookEvent: { create: jest.fn() } };
}

describe('TelegramWebhookEventsRepository.persist', () => {
  it('should call db.webhookEvent.create with provider=telegram and a signature-valid flag', async () => {
    const db = buildDb();
    const now = new Date('2026-07-08T15:30:00.000Z');
    db.webhookEvent.create.mockResolvedValue({ id: 'evt-1', receivedAt: now });
    const repo = new TelegramWebhookEventsRepository(db as unknown as PrismaClient);

    const result = await repo.persist({
      hotelId: HOTEL_ID,
      signatureValid: true,
      payload: { update_id: 42, message: { message_id: 1, date: 0, chat: { id: 1 } } },
    });

    const args = db.webhookEvent.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data['hotelId']).toBe(HOTEL_ID);
    expect(args.data['provider']).toBe('telegram');
    expect(args.data['signatureValid']).toBe(true);
    expect(args.data['payload']).toEqual({
      update_id: 42,
      message: { message_id: 1, date: 0, chat: { id: 1 } },
    });
    expect(result).toEqual({ id: 'evt-1', receivedAt: now });
  });

  it('should JSON round-trip the payload so Prisma receives a plain InputJsonValue shape', async () => {
    const db = buildDb();
    db.webhookEvent.create.mockResolvedValue({ id: 'evt-2', receivedAt: new Date() });
    const repo = new TelegramWebhookEventsRepository(db as unknown as PrismaClient);

    // Object with a non-JSON value; round-trip should drop it.
    const raw = { update_id: 1, fn: () => 'nope', message: { text: 'hi' } };
    await repo.persist({ hotelId: HOTEL_ID, signatureValid: true, payload: raw });

    const args = db.webhookEvent.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    const payload = args.data['payload'] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('fn');
    expect(payload['update_id']).toBe(1);
  });

  it('should surface signatureValid=false when the caller passes it', async () => {
    const db = buildDb();
    db.webhookEvent.create.mockResolvedValue({ id: 'evt-3', receivedAt: new Date() });
    const repo = new TelegramWebhookEventsRepository(db as unknown as PrismaClient);

    await repo.persist({ hotelId: HOTEL_ID, signatureValid: false, payload: {} });

    const args = db.webhookEvent.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data['signatureValid']).toBe(false);
  });
});
