import { describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient, TelegramConfig } from '@prisma/client';

import { TelegramConfigRepository } from '../telegram.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

function buildRow(overrides: Partial<TelegramConfig> = {}): TelegramConfig {
  return {
    hotelId: HOTEL_ID,
    botTokenEnc: 'v1:iv:ct:tag',
    botUsername: 'qooma_demo_bot',
    defaultChatId: null,
    gmTelegramId: null,
    webhookUrl: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

interface DbMock {
  telegramConfig: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
}

function buildDbMock(): DbMock {
  return {
    telegramConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
}

describe('TelegramConfigRepository.findByHotelId', () => {
  it('should return null when no row exists', async () => {
    const db = buildDbMock();
    db.telegramConfig.findUnique.mockResolvedValue(null);
    const repo = new TelegramConfigRepository(db as unknown as PrismaClient);

    const result = await repo.findByHotelId(HOTEL_ID);

    expect(result).toBeNull();
    expect(db.telegramConfig.findUnique).toHaveBeenCalledWith({ where: { hotelId: HOTEL_ID } });
  });

  it('should map row to domain when row exists', async () => {
    const db = buildDbMock();
    const row = buildRow({ defaultChatId: '-100999' });
    db.telegramConfig.findUnique.mockResolvedValue(row);
    const repo = new TelegramConfigRepository(db as unknown as PrismaClient);

    const result = await repo.findByHotelId(HOTEL_ID);

    expect(result).not.toBeNull();
    expect(result?.hotelId).toBe(row.hotelId);
    expect(result?.botTokenEnc).toBe(row.botTokenEnc);
    expect(result?.botUsername).toBe(row.botUsername);
    expect(result?.defaultChatId).toBe('-100999');
    expect(result?.gmTelegramId).toBeNull();
    expect(result?.webhookUrl).toBeNull();
    expect(result?.createdAt).toEqual(row.createdAt);
    expect(result?.updatedAt).toEqual(row.updatedAt);
  });
});

describe('TelegramConfigRepository.upsert', () => {
  it('should call db.telegramConfig.upsert with create + update payloads', async () => {
    const db = buildDbMock();
    const row = buildRow({
      botTokenEnc: 'v1:new-ct',
      defaultChatId: '-100777',
      webhookUrl: 'https://example.com/tg',
    });
    db.telegramConfig.upsert.mockResolvedValue(row);
    const repo = new TelegramConfigRepository(db as unknown as PrismaClient);

    const result = await repo.upsert(HOTEL_ID, {
      botTokenEnc: 'v1:new-ct',
      botUsername: 'qooma_demo_bot',
      defaultChatId: '-100777',
      gmTelegramId: null,
      webhookUrl: 'https://example.com/tg',
    });

    expect(db.telegramConfig.upsert).toHaveBeenCalledTimes(1);
    const call = db.telegramConfig.upsert.mock.calls[0]?.[0] as {
      where: { hotelId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(call.where).toEqual({ hotelId: HOTEL_ID });
    expect(call.create).toMatchObject({
      hotelId: HOTEL_ID,
      botTokenEnc: 'v1:new-ct',
      botUsername: 'qooma_demo_bot',
      defaultChatId: '-100777',
      gmTelegramId: null,
      webhookUrl: 'https://example.com/tg',
    });
    expect(call.update).toMatchObject({
      botTokenEnc: 'v1:new-ct',
      botUsername: 'qooma_demo_bot',
      defaultChatId: '-100777',
      gmTelegramId: null,
      webhookUrl: 'https://example.com/tg',
    });
    expect(call.update).not.toHaveProperty('hotelId');
    expect(result.hotelId).toBe(HOTEL_ID);
    expect(result.botTokenEnc).toBe('v1:new-ct');
    expect(result.defaultChatId).toBe('-100777');
    expect(result.webhookUrl).toBe('https://example.com/tg');
  });
});
