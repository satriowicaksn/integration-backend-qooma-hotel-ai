import { describe, expect, it, jest } from '@jest/globals';

import type { TelegramConfigRepository } from '@modules/telegram/telegram.repository.js';
import type { TelegramConfigDomain } from '@modules/telegram/telegram.types.js';

import { TelegramConfigReadAdapter } from '../adapters/telegram-config-read.adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

interface RepoMock {
  findByHotelId: jest.Mock<TelegramConfigRepository['findByHotelId']>;
}

function buildRepo(): RepoMock {
  return {
    findByHotelId: jest.fn<TelegramConfigRepository['findByHotelId']>(),
  };
}

function buildDomain(): TelegramConfigDomain {
  return {
    hotelId: HOTEL_ID,
    botTokenEnc: 'v1:abc:def:ghi',
    botUsername: 'qooma_demo_bot',
    defaultChatId: '-100999',
    gmTelegramId: '55555',
    webhookUrl: 'https://example.com/tg',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
  };
}

describe('TelegramConfigReadAdapter.getForHotel', () => {
  it('should return null when the repo has no config for the hotel', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(null);
    const adapter = new TelegramConfigReadAdapter(repo as unknown as TelegramConfigRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result).toBeNull();
    expect(repo.findByHotelId).toHaveBeenCalledWith(HOTEL_ID);
  });

  it('should map the domain to the narrow TelegramConfigForDispatch view when the repo returns a row', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(buildDomain());
    const adapter = new TelegramConfigReadAdapter(repo as unknown as TelegramConfigRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result).toEqual({
      botTokenEnc: 'v1:abc:def:ghi',
      botUsername: 'qooma_demo_bot',
    });
  });

  it('should NOT include hotelId or timestamps in the returned view (narrow reader-port discipline)', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(buildDomain());
    const adapter = new TelegramConfigReadAdapter(repo as unknown as TelegramConfigRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result).not.toHaveProperty('hotelId');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('updatedAt');
    expect(result).not.toHaveProperty('defaultChatId');
  });
});
