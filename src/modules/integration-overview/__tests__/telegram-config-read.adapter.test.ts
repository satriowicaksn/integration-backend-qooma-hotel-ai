import { describe, expect, it, jest } from '@jest/globals';

import type { TelegramConfigRepository } from '@modules/telegram/telegram.repository.js';
import type { TelegramConfigDomain } from '@modules/telegram/telegram.types.js';

import { TelegramConfigReadAdapter } from '../adapters/telegram-config-read.adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

function buildDomain(overrides: Partial<TelegramConfigDomain> = {}): TelegramConfigDomain {
  return {
    hotelId: HOTEL_ID,
    botTokenEnc: 'v1:abc:def:ghi',
    botUsername: 'qooma_demo_bot',
    defaultChatId: '-100999',
    gmTelegramId: null,
    webhookUrl: 'https://example.com/tg',
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

interface RepoMock {
  findByHotelId: jest.Mock<TelegramConfigRepository['findByHotelId']>;
}

function buildRepo(): RepoMock {
  return { findByHotelId: jest.fn<TelegramConfigRepository['findByHotelId']>() };
}

describe('TelegramConfigReadAdapter.getForHotel', () => {
  it('should return null when the repo has no row for the hotel', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(null);
    const adapter = new TelegramConfigReadAdapter(repo as unknown as TelegramConfigRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result).toBeNull();
  });

  it('should map the persisted domain to the TelegramOverviewView', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(buildDomain());
    const adapter = new TelegramConfigReadAdapter(repo as unknown as TelegramConfigRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result).toEqual({
      botUsername: 'qooma_demo_bot',
      hasBotToken: true,
      defaultChatId: '-100999',
      webhookUrl: 'https://example.com/tg',
    });
  });

  it('should signal hasBotToken=false when the envelope is empty string', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(buildDomain({ botTokenEnc: '' }));
    const adapter = new TelegramConfigReadAdapter(repo as unknown as TelegramConfigRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result?.hasBotToken).toBe(false);
  });
});
