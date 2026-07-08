import { describe, expect, it, jest } from '@jest/globals';

import type { ChannelHealthRepository } from '@modules/channel-health/channel-health.repository.js';
import type {
  ChannelHealthDomain,
  HealthProvider,
  HealthStatus,
} from '@modules/channel-health/channel-health.types.js';

import { ChannelHealthReadAdapter } from '../adapters/channel-health-read.adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const NOW = new Date('2026-07-08T13:00:00Z');
const CHECK_AT = new Date('2026-07-08T12:59:00Z');

function buildDomain(provider: HealthProvider, status: HealthStatus): ChannelHealthDomain {
  return {
    id: `snap-${provider}`,
    hotelId: HOTEL_ID,
    provider,
    status,
    latencyMs: 42,
    checkedAt: CHECK_AT,
  };
}

interface RepoMock {
  findLatestByHotelProvider: jest.Mock<ChannelHealthRepository['findLatestByHotelProvider']>;
}

function buildRepo(): RepoMock {
  return {
    findLatestByHotelProvider: jest.fn<ChannelHealthRepository['findLatestByHotelProvider']>(),
  };
}

function buildAdapter(repo: RepoMock): ChannelHealthReadAdapter {
  return new ChannelHealthReadAdapter(repo as unknown as ChannelHealthRepository, {
    now: () => NOW,
  });
}

describe('ChannelHealthReadAdapter.getSnapshot', () => {
  it('should return healthy pills for all three providers when snapshots are present', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockImplementation((_hotelId, provider) =>
      Promise.resolve(buildDomain(provider, 'healthy')),
    );
    const adapter = buildAdapter(repo);

    const result = await adapter.getSnapshot({ hotelId: HOTEL_ID });

    expect(result).toEqual({
      whatsapp: { status: 'healthy', lastMessageAt: CHECK_AT.toISOString() },
      telegram: { status: 'healthy', lastMessageAt: CHECK_AT.toISOString() },
      claudeApi: { status: 'healthy', lastCheckAt: CHECK_AT.toISOString() },
    });
  });

  it('should fall back to `down` with injected-clock lastCheckAt when Claude API snapshot is missing', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockImplementation((_hotelId, provider) => {
      if (provider === 'claude_api') return Promise.resolve(null);
      return Promise.resolve(buildDomain(provider, 'healthy'));
    });
    const adapter = buildAdapter(repo);

    const result = await adapter.getSnapshot({ hotelId: HOTEL_ID });

    expect(result.claudeApi).toEqual({ status: 'down', lastCheckAt: NOW.toISOString() });
    expect(result.whatsapp.status).toBe('healthy');
    expect(result.telegram.status).toBe('healthy');
  });

  it('should fall back to `down` with lastMessageAt=null when the WhatsApp snapshot is missing', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockImplementation((_hotelId, provider) => {
      if (provider === 'whatsapp') return Promise.resolve(null);
      return Promise.resolve(buildDomain(provider, 'healthy'));
    });
    const adapter = buildAdapter(repo);

    const result = await adapter.getSnapshot({ hotelId: HOTEL_ID });

    expect(result.whatsapp).toEqual({ status: 'down', lastMessageAt: null });
  });

  it('should fall back to `down` with lastMessageAt=null when the Telegram snapshot is missing', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockImplementation((_hotelId, provider) => {
      if (provider === 'telegram') return Promise.resolve(null);
      return Promise.resolve(buildDomain(provider, 'healthy'));
    });
    const adapter = buildAdapter(repo);

    const result = await adapter.getSnapshot({ hotelId: HOTEL_ID });

    expect(result.telegram).toEqual({ status: 'down', lastMessageAt: null });
    expect(result.whatsapp.status).toBe('healthy');
    expect(result.claudeApi.status).toBe('healthy');
  });

  it('should default to all-down when the hotel has no snapshots at all', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockResolvedValue(null);
    const adapter = buildAdapter(repo);

    const result = await adapter.getSnapshot({ hotelId: HOTEL_ID });

    expect(result.whatsapp.status).toBe('down');
    expect(result.telegram.status).toBe('down');
    expect(result.claudeApi.status).toBe('down');
    expect(result.claudeApi.lastCheckAt).toBe(NOW.toISOString());
  });

  it('should query all three providers in parallel with the hotelId', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockResolvedValue(null);
    const adapter = buildAdapter(repo);

    await adapter.getSnapshot({ hotelId: HOTEL_ID });

    expect(repo.findLatestByHotelProvider).toHaveBeenCalledTimes(3);
    expect(repo.findLatestByHotelProvider).toHaveBeenCalledWith(HOTEL_ID, 'whatsapp');
    expect(repo.findLatestByHotelProvider).toHaveBeenCalledWith(HOTEL_ID, 'telegram');
    expect(repo.findLatestByHotelProvider).toHaveBeenCalledWith(HOTEL_ID, 'claude_api');
  });

  it('should preserve non-healthy statuses on present rows (e.g. degraded)', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockImplementation((_hotelId, provider) =>
      Promise.resolve(buildDomain(provider, 'degraded')),
    );
    const adapter = buildAdapter(repo);

    const result = await adapter.getSnapshot({ hotelId: HOTEL_ID });

    expect(result.whatsapp.status).toBe('degraded');
    expect(result.telegram.status).toBe('degraded');
    expect(result.claudeApi.status).toBe('degraded');
  });

  it('should fall back to SYSTEM_CLOCK (real wall clock) when no clock is injected (binding #3 default)', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockResolvedValue(null);
    const adapter = new ChannelHealthReadAdapter(repo as unknown as ChannelHealthRepository);

    const before = new Date();
    const result = await adapter.getSnapshot({ hotelId: HOTEL_ID });
    const after = new Date();

    const lastCheckAt = new Date(result.claudeApi.lastCheckAt);
    expect(lastCheckAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(lastCheckAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
