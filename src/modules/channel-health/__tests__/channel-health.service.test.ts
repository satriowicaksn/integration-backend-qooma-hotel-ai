import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import type { ChannelHealthRepository } from '../channel-health.repository.js';
import {
  ChannelHealthService,
  currentStatusOr,
  PROVIDER_ORDER,
} from '../channel-health.service.js';
import type {
  ChannelHealthDomain,
  HealthChangedEvent,
  HealthProvider,
  ProbeResult,
} from '../channel-health.types.js';
import type { ClaudeApiHealthProbePort } from '../ports/claude-api-health-probe.port.js';
import type { TelegramHealthProbePort } from '../ports/telegram-health-probe.port.js';
import type { WhatsappHealthProbePort } from '../ports/whatsapp-health-probe.port.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const CHECKED_AT = new Date('2026-07-06T14:00:00Z');

interface RepoMock {
  findLatestByHotelProvider: jest.Mock<ChannelHealthRepository['findLatestByHotelProvider']>;
  insertSnapshot: jest.Mock<ChannelHealthRepository['insertSnapshot']>;
}

interface ProbeMock {
  probe: jest.Mock<(input: { hotelId: string }) => Promise<ProbeResult>>;
}

interface LoggerMock extends Logger {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

function buildProbeMock(): ProbeMock {
  return { probe: jest.fn<(input: { hotelId: string }) => Promise<ProbeResult>>() };
}

function buildRepoMock(): RepoMock {
  return {
    findLatestByHotelProvider: jest.fn<ChannelHealthRepository['findLatestByHotelProvider']>(),
    insertSnapshot: jest.fn<ChannelHealthRepository['insertSnapshot']>(),
  };
}

function buildLoggerMock(): LoggerMock {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function buildDomain(
  provider: HealthProvider,
  overrides: Partial<ChannelHealthDomain> = {},
): ChannelHealthDomain {
  return {
    id: `snap-${provider}`,
    hotelId: HOTEL_ID,
    provider,
    status: 'healthy',
    latencyMs: 100,
    checkedAt: CHECKED_AT,
    ...overrides,
  };
}

function buildService(): {
  service: ChannelHealthService;
  repo: RepoMock;
  waProbe: ProbeMock;
  telegramProbe: ProbeMock;
  claudeProbe: ProbeMock;
  logger: LoggerMock;
} {
  const repo = buildRepoMock();
  const waProbe = buildProbeMock();
  const telegramProbe = buildProbeMock();
  const claudeProbe = buildProbeMock();
  const logger = buildLoggerMock();
  const service = new ChannelHealthService(
    repo as unknown as ChannelHealthRepository,
    {
      whatsapp: waProbe as unknown as WhatsappHealthProbePort,
      telegram: telegramProbe as unknown as TelegramHealthProbePort,
      claudeApi: claudeProbe as unknown as ClaudeApiHealthProbePort,
    },
    logger,
  );
  return { service, repo, waProbe, telegramProbe, claudeProbe, logger };
}

describe('ChannelHealthService.runProbesForHotel — orchestration', () => {
  it('should invoke all three provider probes in PROVIDER_ORDER', async () => {
    const { service, repo, waProbe, telegramProbe, claudeProbe } = buildService();
    repo.findLatestByHotelProvider.mockResolvedValue(null);
    waProbe.probe.mockResolvedValue({ ok: true, latencyMs: 10 });
    telegramProbe.probe.mockResolvedValue({ ok: true, latencyMs: 20 });
    claudeProbe.probe.mockResolvedValue({ ok: true, latencyMs: 30 });
    repo.insertSnapshot.mockImplementation((input) =>
      Promise.resolve(
        buildDomain(input.provider, { status: input.status, latencyMs: input.latencyMs }),
      ),
    );

    await service.runProbesForHotel(HOTEL_ID);

    expect(waProbe.probe).toHaveBeenCalledWith({ hotelId: HOTEL_ID });
    expect(telegramProbe.probe).toHaveBeenCalledWith({ hotelId: HOTEL_ID });
    expect(claudeProbe.probe).toHaveBeenCalledWith({ hotelId: HOTEL_ID });
    expect(PROVIDER_ORDER).toEqual(['whatsapp', 'telegram', 'claude_api']);
  });

  it('should insert one snapshot per provider (per-poll insert per GAP-#1)', async () => {
    const { service, repo, waProbe, telegramProbe, claudeProbe } = buildService();
    repo.findLatestByHotelProvider.mockResolvedValue(null);
    waProbe.probe.mockResolvedValue({ ok: true, latencyMs: 10 });
    telegramProbe.probe.mockResolvedValue({ ok: true, latencyMs: 20 });
    claudeProbe.probe.mockResolvedValue({ ok: true, latencyMs: 30 });
    repo.insertSnapshot.mockImplementation((input) =>
      Promise.resolve(
        buildDomain(input.provider, { status: input.status, latencyMs: input.latencyMs }),
      ),
    );

    await service.runProbesForHotel(HOTEL_ID);

    expect(repo.insertSnapshot).toHaveBeenCalledTimes(3);
    const providers = repo.insertSnapshot.mock.calls.map(([input]) => input?.provider);
    expect(providers).toEqual(['whatsapp', 'telegram', 'claude_api']);
  });

  it('should persist latencyMs on success and null on failure', async () => {
    const { service, repo, waProbe, telegramProbe, claudeProbe } = buildService();
    repo.findLatestByHotelProvider.mockResolvedValue(null);
    waProbe.probe.mockResolvedValue({ ok: true, latencyMs: 42 });
    telegramProbe.probe.mockResolvedValue({ ok: false, error: 'timeout' });
    claudeProbe.probe.mockResolvedValue({ ok: true, latencyMs: 123 });
    repo.insertSnapshot.mockImplementation((input) =>
      Promise.resolve(
        buildDomain(input.provider, { status: input.status, latencyMs: input.latencyMs }),
      ),
    );

    await service.runProbesForHotel(HOTEL_ID);

    const [wa, tg, claude] = repo.insertSnapshot.mock.calls.map(([input]) => input);
    expect(wa?.latencyMs).toBe(42);
    expect(tg?.latencyMs).toBeNull();
    expect(claude?.latencyMs).toBe(123);
  });

  it('should log per-probe result including transition flag', async () => {
    const { service, repo, waProbe, telegramProbe, claudeProbe, logger } = buildService();
    repo.findLatestByHotelProvider.mockResolvedValue(null);
    waProbe.probe.mockResolvedValue({ ok: true, latencyMs: 10 });
    telegramProbe.probe.mockResolvedValue({ ok: true, latencyMs: 20 });
    claudeProbe.probe.mockResolvedValue({ ok: true, latencyMs: 30 });
    repo.insertSnapshot.mockImplementation((input) =>
      Promise.resolve(
        buildDomain(input.provider, { status: input.status, latencyMs: input.latencyMs }),
      ),
    );

    await service.runProbesForHotel(HOTEL_ID);

    expect(logger.info).toHaveBeenCalledTimes(3);
    const first = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(first).toMatchObject({
      msg: 'channel_health.probed',
      module: 'channel-health',
      hotelId: HOTEL_ID,
      provider: 'whatsapp',
      status: 'healthy',
      transitioned: true,
    });
  });
});

describe('ChannelHealthService.runProbesForHotel — HealthChangedEvent emission (spec §4.8 transition-only)', () => {
  it('should NOT emit an event when status is unchanged (healthy → healthy)', async () => {
    const { service, repo, waProbe, telegramProbe, claudeProbe } = buildService();
    repo.findLatestByHotelProvider.mockImplementation((_hotel, provider) =>
      Promise.resolve(buildDomain(provider, { status: 'healthy' })),
    );
    waProbe.probe.mockResolvedValue({ ok: true, latencyMs: 10 });
    telegramProbe.probe.mockResolvedValue({ ok: true, latencyMs: 20 });
    claudeProbe.probe.mockResolvedValue({ ok: true, latencyMs: 30 });
    repo.insertSnapshot.mockImplementation((input) =>
      Promise.resolve(
        buildDomain(input.provider, { status: input.status, latencyMs: input.latencyMs }),
      ),
    );

    const events = await service.runProbesForHotel(HOTEL_ID);

    expect(events).toHaveLength(0);
  });

  it('should emit exactly one event per provider that transitions', async () => {
    const { service, repo, waProbe, telegramProbe, claudeProbe } = buildService();
    repo.findLatestByHotelProvider.mockImplementation((_hotel, provider) =>
      Promise.resolve(buildDomain(provider, { status: 'healthy' })),
    );
    waProbe.probe.mockResolvedValue({ ok: false, error: 'timeout' }); // healthy → degraded
    telegramProbe.probe.mockResolvedValue({ ok: true, latencyMs: 20 });
    claudeProbe.probe.mockResolvedValue({ ok: false, error: '500' }); // healthy → degraded
    repo.insertSnapshot.mockImplementation((input) =>
      Promise.resolve(
        buildDomain(input.provider, { status: input.status, latencyMs: input.latencyMs }),
      ),
    );

    const events = await service.runProbesForHotel(HOTEL_ID);

    expect(events).toHaveLength(2);
    const byProvider = new Map(events.map((e) => [e.provider, e]));
    expect(byProvider.get('whatsapp')).toMatchObject({
      previousStatus: 'healthy',
      newStatus: 'degraded',
    });
    expect(byProvider.get('claude_api')).toMatchObject({
      previousStatus: 'healthy',
      newStatus: 'degraded',
    });
    expect(byProvider.has('telegram')).toBe(false);
  });

  it('should emit the confirmed-down event only on the second consecutive failure', async () => {
    const { service, repo, waProbe, telegramProbe, claudeProbe } = buildService();
    repo.findLatestByHotelProvider.mockImplementation((_hotel, provider) =>
      Promise.resolve(buildDomain(provider, { status: 'degraded' })),
    );
    waProbe.probe.mockResolvedValue({ ok: false, error: 'timeout' });
    telegramProbe.probe.mockResolvedValue({ ok: true, latencyMs: 20 });
    claudeProbe.probe.mockResolvedValue({ ok: true, latencyMs: 30 });
    repo.insertSnapshot.mockImplementation((input) =>
      Promise.resolve(
        buildDomain(input.provider, { status: input.status, latencyMs: input.latencyMs }),
      ),
    );

    const events = await service.runProbesForHotel(HOTEL_ID);

    const waEvent = events.find((e: HealthChangedEvent) => e.provider === 'whatsapp');
    expect(waEvent).toMatchObject({ previousStatus: 'degraded', newStatus: 'down' });
    const tgEvent = events.find((e: HealthChangedEvent) => e.provider === 'telegram');
    expect(tgEvent).toMatchObject({ previousStatus: 'degraded', newStatus: 'healthy' });
  });

  it('should carry the snapshot checkedAt through to the emitted event', async () => {
    const { service, repo, waProbe, telegramProbe, claudeProbe } = buildService();
    const distinctTime = new Date('2026-07-06T15:30:00Z');
    repo.findLatestByHotelProvider.mockResolvedValue(null);
    waProbe.probe.mockResolvedValue({ ok: true, latencyMs: 5 });
    telegramProbe.probe.mockResolvedValue({ ok: true, latencyMs: 5 });
    claudeProbe.probe.mockResolvedValue({ ok: true, latencyMs: 5 });
    repo.insertSnapshot.mockImplementation((input) =>
      Promise.resolve(
        buildDomain(input.provider, {
          status: input.status,
          latencyMs: input.latencyMs,
          checkedAt: distinctTime,
        }),
      ),
    );

    const events = await service.runProbesForHotel(HOTEL_ID);

    expect(events.every((e) => e.checkedAt.getTime() === distinctTime.getTime())).toBe(true);
  });
});

describe('currentStatusOr', () => {
  it('should return the snapshot status when present', () => {
    expect(currentStatusOr(buildDomain('whatsapp', { status: 'down' }))).toBe('down');
  });

  it('should fall back to healthy when no snapshot exists (optimistic default per spec §2.2)', () => {
    expect(currentStatusOr(null)).toBe('healthy');
  });
});
