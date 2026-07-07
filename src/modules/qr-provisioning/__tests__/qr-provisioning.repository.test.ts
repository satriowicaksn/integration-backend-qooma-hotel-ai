import { describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient, QrState } from '@prisma/client';

import { QrStateRepository } from '../qr-provisioning.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

function buildRow(overrides: Partial<QrState> = {}): QrState {
  return {
    hotelId: HOTEL_ID,
    waLink: 'https://wa.me/6281234567890',
    pngUrl: 'https://cdn.example.com/qr/hotel-1.png',
    generatedAt: new Date('2026-07-06T22:30:00Z'),
    ...overrides,
  };
}

interface DbMock {
  qrState: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
}

function buildDbMock(): DbMock {
  return {
    qrState: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
}

describe('QrStateRepository.findByHotelId', () => {
  it('should return null when no qr_state row exists for the hotel', async () => {
    const db = buildDbMock();
    db.qrState.findUnique.mockResolvedValue(null);
    const repo = new QrStateRepository(db as unknown as PrismaClient);

    const result = await repo.findByHotelId(HOTEL_ID);

    expect(result).toBeNull();
    expect(db.qrState.findUnique).toHaveBeenCalledWith({ where: { hotelId: HOTEL_ID } });
  });

  it('should map the row to the QrDomain shape when a row exists', async () => {
    const db = buildDbMock();
    const row = buildRow({ waLink: 'https://wa.me/999', pngUrl: 'https://x.io/q.png' });
    db.qrState.findUnique.mockResolvedValue(row);
    const repo = new QrStateRepository(db as unknown as PrismaClient);

    const result = await repo.findByHotelId(HOTEL_ID);

    expect(result).toEqual({
      hotelId: row.hotelId,
      waLink: 'https://wa.me/999',
      pngUrl: 'https://x.io/q.png',
      generatedAt: row.generatedAt,
    });
  });
});

describe('QrStateRepository.upsert', () => {
  it('should call qrState.upsert with matching create + update payloads and return the mapped domain', async () => {
    const db = buildDbMock();
    const row = buildRow({ waLink: 'https://wa.me/999', pngUrl: 'https://x.io/q2.png' });
    db.qrState.upsert.mockResolvedValue(row);
    const repo = new QrStateRepository(db as unknown as PrismaClient);

    const generatedAt = new Date('2026-07-06T22:35:00Z');
    const result = await repo.upsert({
      hotelId: HOTEL_ID,
      waLink: 'https://wa.me/999',
      pngUrl: 'https://x.io/q2.png',
      generatedAt,
    });

    expect(db.qrState.upsert).toHaveBeenCalledTimes(1);
    const call = db.qrState.upsert.mock.calls[0]?.[0] as {
      where: { hotelId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(call.where).toEqual({ hotelId: HOTEL_ID });
    expect(call.create).toEqual({
      hotelId: HOTEL_ID,
      waLink: 'https://wa.me/999',
      pngUrl: 'https://x.io/q2.png',
      generatedAt,
    });
    expect(call.update).toEqual({
      waLink: 'https://wa.me/999',
      pngUrl: 'https://x.io/q2.png',
      generatedAt,
    });
    expect(call.update).not.toHaveProperty('hotelId');
    expect(result.waLink).toBe('https://wa.me/999');
    expect(result.pngUrl).toBe('https://x.io/q2.png');
  });

  it('should carry generatedAt through explicitly so tests can assert deterministic clock values', async () => {
    const db = buildDbMock();
    const fixedAt = new Date('2026-01-01T00:00:00Z');
    db.qrState.upsert.mockImplementation((args: unknown) => {
      const req = args as { create: { generatedAt: Date } };
      return Promise.resolve(buildRow({ generatedAt: req.create.generatedAt }));
    });
    const repo = new QrStateRepository(db as unknown as PrismaClient);

    const result = await repo.upsert({
      hotelId: HOTEL_ID,
      waLink: 'https://wa.me/1',
      pngUrl: 'https://x.io/q.png',
      generatedAt: fixedAt,
    });

    expect(result.generatedAt).toEqual(fixedAt);
  });
});
