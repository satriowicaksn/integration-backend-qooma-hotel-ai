import { describe, expect, it, jest } from '@jest/globals';

import type { QrStateRepository } from '@modules/qr-provisioning/qr-provisioning.repository.js';
import type { QrDomain } from '@modules/qr-provisioning/qr-provisioning.types.js';

import { QrStateReadAdapter } from '../adapters/qr-state-read.adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

function buildDomain(overrides: Partial<QrDomain> = {}): QrDomain {
  return {
    hotelId: HOTEL_ID,
    waLink: 'https://wa.me/62800001111',
    pngUrl: 'https://cdn.qooma.example/qr/hotel-1.png',
    generatedAt: new Date('2026-07-06T12:34:56Z'),
    ...overrides,
  };
}

interface RepoMock {
  findByHotelId: jest.Mock<QrStateRepository['findByHotelId']>;
}

function buildRepo(): RepoMock {
  return { findByHotelId: jest.fn<QrStateRepository['findByHotelId']>() };
}

describe('QrStateReadAdapter.getForHotel', () => {
  it('should return null when the repo has no row for the hotel', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(null);
    const adapter = new QrStateReadAdapter(repo as unknown as QrStateRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result).toBeNull();
  });

  it('should map waLink → url and expose pngUrl + ISO generatedAt', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(buildDomain());
    const adapter = new QrStateReadAdapter(repo as unknown as QrStateRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result).toEqual({
      url: 'https://wa.me/62800001111',
      pngUrl: 'https://cdn.qooma.example/qr/hotel-1.png',
      generatedAt: '2026-07-06T12:34:56.000Z',
    });
  });

  it('should forward the hotelId to the repository', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(null);
    const adapter = new QrStateReadAdapter(repo as unknown as QrStateRepository);

    await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(repo.findByHotelId).toHaveBeenCalledWith(HOTEL_ID);
  });
});
