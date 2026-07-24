import { describe, expect, it, jest } from '@jest/globals';
import type { WaConfig } from '@prisma/client';

import type { WhatsappConfigRepository } from '@modules/whatsapp/whatsapp-config.repository.js';

import { WhatsappConfigReadAdapter } from '../adapters/whatsapp-config-read.adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

function buildRow(overrides: Partial<WaConfig> = {}): WaConfig {
  return {
    hotelId: HOTEL_ID,
    bsp: '1engage',
    phoneNumberId: 'pnid-1',
    phoneNumber: '+62800001111',
    accessTokenEnc: 'v1:abc:def:ghi',
    webhookUrl: 'https://example.com/wa',
    webhookVerifyToken: 'x'.repeat(32),
    verifiedAt: new Date('2026-07-05T10:00:00Z'),
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-05T10:00:00Z'),
    ...overrides,
  } as WaConfig;
}

interface RepoMock {
  findByHotelId: jest.Mock<WhatsappConfigRepository['findByHotelId']>;
}

function buildRepo(): RepoMock {
  return { findByHotelId: jest.fn<WhatsappConfigRepository['findByHotelId']>() };
}

describe('WhatsappConfigReadAdapter.getForHotel', () => {
  it('should return null when the repo has no row for the hotel', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(null);
    const adapter = new WhatsappConfigReadAdapter(repo as unknown as WhatsappConfigRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result).toBeNull();
    expect(repo.findByHotelId).toHaveBeenCalledWith(HOTEL_ID);
  });

  it('should map a fully-configured row to the WhatsappOverviewView (verified)', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(buildRow());
    const adapter = new WhatsappConfigReadAdapter(repo as unknown as WhatsappConfigRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result).toEqual({
      bsp: '1engage',
      phoneNumber: '+62800001111',
      phoneNumberId: 'pnid-1',
      verifiedAt: '2026-07-05T10:00:00.000Z',
      hasAccessToken: true,
      webhookUrl: 'https://example.com/wa',
      webhookVerifyToken: 'x'.repeat(32),
      wabaId: null,
    });
  });

  it('should surface verifiedAt as null when the row has not been verified', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(buildRow({ verifiedAt: null }));
    const adapter = new WhatsappConfigReadAdapter(repo as unknown as WhatsappConfigRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result?.verifiedAt).toBeNull();
  });

  it('should signal hasAccessToken=false when the envelope is empty string', async () => {
    const repo = buildRepo();
    repo.findByHotelId.mockResolvedValue(buildRow({ accessTokenEnc: '' }));
    const adapter = new WhatsappConfigReadAdapter(repo as unknown as WhatsappConfigRepository);

    const result = await adapter.getForHotel({ hotelId: HOTEL_ID });

    expect(result?.hasAccessToken).toBe(false);
  });
});
