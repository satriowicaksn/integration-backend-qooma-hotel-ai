import { describe, expect, it, jest } from '@jest/globals';
import type { ChannelHealthSnapshot, PrismaClient } from '@prisma/client';

import { ChannelHealthRepository } from '../channel-health.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

function buildRow(overrides: Partial<ChannelHealthSnapshot> = {}): ChannelHealthSnapshot {
  return {
    id: 'snap-uuid-1',
    hotelId: HOTEL_ID,
    provider: 'whatsapp',
    status: 'healthy',
    latencyMs: 120,
    checkedAt: new Date('2026-07-06T14:00:00Z'),
    ...overrides,
  };
}

interface DbMock {
  channelHealthSnapshot: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
}

function buildDbMock(): DbMock {
  return {
    channelHealthSnapshot: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
}

describe('ChannelHealthRepository.findLatestByHotelProvider', () => {
  it('should return null when no snapshot exists for hotel + provider', async () => {
    const db = buildDbMock();
    db.channelHealthSnapshot.findFirst.mockResolvedValue(null);
    const repo = new ChannelHealthRepository(db as unknown as PrismaClient);

    const result = await repo.findLatestByHotelProvider(HOTEL_ID, 'whatsapp');

    expect(result).toBeNull();
    expect(db.channelHealthSnapshot.findFirst).toHaveBeenCalledWith({
      where: { hotelId: HOTEL_ID, provider: 'whatsapp' },
      orderBy: { checkedAt: 'desc' },
    });
  });

  it('should map row to domain when snapshot exists', async () => {
    const db = buildDbMock();
    const row = buildRow({ status: 'degraded', latencyMs: null });
    db.channelHealthSnapshot.findFirst.mockResolvedValue(row);
    const repo = new ChannelHealthRepository(db as unknown as PrismaClient);

    const result = await repo.findLatestByHotelProvider(HOTEL_ID, 'whatsapp');

    expect(result).not.toBeNull();
    expect(result?.status).toBe('degraded');
    expect(result?.latencyMs).toBeNull();
    expect(result?.hotelId).toBe(HOTEL_ID);
    expect(result?.provider).toBe('whatsapp');
    expect(result?.checkedAt).toEqual(row.checkedAt);
  });
});

describe('ChannelHealthRepository.insertSnapshot', () => {
  it('should call create with hotelId + provider + status + latencyMs and return domain', async () => {
    const db = buildDbMock();
    const row = buildRow({ status: 'down', latencyMs: null });
    db.channelHealthSnapshot.create.mockResolvedValue(row);
    const repo = new ChannelHealthRepository(db as unknown as PrismaClient);

    const result = await repo.insertSnapshot({
      hotelId: HOTEL_ID,
      provider: 'whatsapp',
      status: 'down',
      latencyMs: null,
    });

    expect(db.channelHealthSnapshot.create).toHaveBeenCalledWith({
      data: {
        hotelId: HOTEL_ID,
        provider: 'whatsapp',
        status: 'down',
        latencyMs: null,
      },
    });
    expect(result.status).toBe('down');
    expect(result.latencyMs).toBeNull();
  });

  it('should persist latencyMs when probe was successful', async () => {
    const db = buildDbMock();
    const row = buildRow({ status: 'healthy', latencyMs: 87 });
    db.channelHealthSnapshot.create.mockResolvedValue(row);
    const repo = new ChannelHealthRepository(db as unknown as PrismaClient);

    await repo.insertSnapshot({
      hotelId: HOTEL_ID,
      provider: 'telegram',
      status: 'healthy',
      latencyMs: 87,
    });

    const call = db.channelHealthSnapshot.create.mock.calls[0]?.[0] as {
      data: { latencyMs: number | null };
    };
    expect(call.data.latencyMs).toBe(87);
  });
});
