// Route-level unit test for T24-followup GET /api/integrations/health.
// Exercises the composition + fallback discipline without a live Postgres:
//   - happy-path: 3 present snapshots → DTO reflects each status
//   - Claude missing → synthetic last_check_at from injected clock
//   - WA / Telegram missing → currentStatusOr optimistic 'healthy' default
//   - HealthResponseSchema.parse() round-trip on the response

import { describe, expect, it, jest } from '@jest/globals';
import Fastify, { type FastifyInstance } from 'fastify';

import { AuthError } from '@core/errors/app-errors.js';

import { registerErrorHandler } from '@plugins/error-handler.plugin.js';

import type { ChannelHealthRepository } from '../channel-health.repository.js';
import { channelHealthRoutes, toHealthResponseDto } from '../channel-health.routes.js';
import { HealthResponseSchema } from '../channel-health.schema.js';
import type { ChannelHealthDomain, HealthProvider } from '../channel-health.types.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const NOW = new Date('2026-07-08T17:30:00.000Z');
const CHECK_AT = new Date('2026-07-08T17:29:00.000Z');

function snap(
  provider: HealthProvider,
  status: ChannelHealthDomain['status'],
): ChannelHealthDomain {
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

async function buildApp(repo: RepoMock, opts: { authed?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  const authGuard: (req: unknown) => Promise<void> = (req) => {
    const r = req as { hotelId?: string };
    if (opts.authed === false) return Promise.reject(new AuthError('missing token'));
    r.hotelId = HOTEL_ID;
    return Promise.resolve();
  };

  await app.register(channelHealthRoutes, {
    repository: repo as unknown as ChannelHealthRepository,
    guards: [
      (req, _reply, done) => {
        authGuard(req).then(
          () => done(),
          (err: unknown) => done(err as Error),
        );
      },
    ],
    clock: { now: () => NOW },
  });
  await app.ready();
  return app;
}

describe('toHealthResponseDto — pure composition', () => {
  it('should map all three snapshots to the snake_case wire shape', () => {
    const dto = toHealthResponseDto(
      {
        wa: snap('whatsapp', 'healthy'),
        telegram: snap('telegram', 'degraded'),
        claude: snap('claude_api', 'healthy'),
      },
      { now: () => NOW },
    );
    expect(dto).toEqual({
      whatsapp: { status: 'healthy', last_message_at: null },
      telegram: { status: 'degraded', last_message_at: null },
      claude_api: { status: 'healthy', last_check_at: CHECK_AT.toISOString() },
    });
  });

  it('should default un-probed WA / Telegram to the currentStatusOr optimistic healthy', () => {
    const dto = toHealthResponseDto(
      { wa: null, telegram: null, claude: snap('claude_api', 'down') },
      { now: () => NOW },
    );
    expect(dto.whatsapp.status).toBe('healthy');
    expect(dto.telegram.status).toBe('healthy');
    expect(dto.claude_api.status).toBe('down');
  });

  it('should fill Claude last_check_at from the injected clock when no snapshot exists', () => {
    const dto = toHealthResponseDto({ wa: null, telegram: null, claude: null }, { now: () => NOW });
    expect(dto.claude_api.last_check_at).toBe(NOW.toISOString());
    expect(dto.claude_api.status).toBe('healthy');
  });

  it('should produce a payload that passes HealthResponseSchema.parse() (binding: authoritative schema round-trip)', () => {
    const dto = toHealthResponseDto(
      {
        wa: snap('whatsapp', 'healthy'),
        telegram: snap('telegram', 'healthy'),
        claude: snap('claude_api', 'healthy'),
      },
      { now: () => NOW },
    );
    expect(() => HealthResponseSchema.parse(dto)).not.toThrow();
  });
});

describe('channelHealthRoutes — GET /api/integrations/health', () => {
  it('should return 401 canonical envelope when the guard rejects', async () => {
    const repo = buildRepo();
    const app = await buildApp(repo, { authed: false });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/integrations/health' });
      expect(res.statusCode).toBe(401);
      expect(res.json<{ error: { code: string } }>().error.code).toBe('AUTH_ERROR');
    } finally {
      await app.close();
    }
  });

  it('should return 200 with all three subsystems reflecting the seeded snapshots', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockImplementation((_hotelId, provider) =>
      Promise.resolve(snap(provider, provider === 'telegram' ? 'degraded' : 'healthy')),
    );
    const app = await buildApp(repo);
    try {
      const res = await app.inject({ method: 'GET', url: '/api/integrations/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json<{
        whatsapp: { status: string };
        telegram: { status: string };
        claude_api: { status: string; last_check_at: string };
      }>();
      expect(body.whatsapp.status).toBe('healthy');
      expect(body.telegram.status).toBe('degraded');
      expect(body.claude_api.status).toBe('healthy');
      expect(body.claude_api.last_check_at).toBe(CHECK_AT.toISOString());
    } finally {
      await app.close();
    }
  });

  it('should query all three providers in parallel with the hotelId', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockResolvedValue(null);
    const app = await buildApp(repo);
    try {
      await app.inject({ method: 'GET', url: '/api/integrations/health' });
      expect(repo.findLatestByHotelProvider).toHaveBeenCalledTimes(3);
      expect(repo.findLatestByHotelProvider).toHaveBeenCalledWith(HOTEL_ID, 'whatsapp');
      expect(repo.findLatestByHotelProvider).toHaveBeenCalledWith(HOTEL_ID, 'telegram');
      expect(repo.findLatestByHotelProvider).toHaveBeenCalledWith(HOTEL_ID, 'claude_api');
    } finally {
      await app.close();
    }
  });

  it('should fall back to injected clock for Claude last_check_at when no snapshot exists yet', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockResolvedValue(null);
    const app = await buildApp(repo);
    try {
      const res = await app.inject({ method: 'GET', url: '/api/integrations/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ claude_api: { last_check_at: string } }>();
      expect(body.claude_api.last_check_at).toBe(NOW.toISOString());
    } finally {
      await app.close();
    }
  });

  it('should fall back to SYSTEM_CLOCK when no clock is injected (default-clock branch)', async () => {
    const repo = buildRepo();
    repo.findLatestByHotelProvider.mockResolvedValue(null);
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    await app.register(channelHealthRoutes, {
      repository: repo as unknown as ChannelHealthRepository,
      guards: [
        (req, _reply, done) => {
          (req as { hotelId?: string }).hotelId = HOTEL_ID;
          done();
        },
      ],
      // clock intentionally omitted
    });
    await app.ready();
    try {
      const before = new Date();
      const res = await app.inject({ method: 'GET', url: '/api/integrations/health' });
      const after = new Date();
      expect(res.statusCode).toBe(200);
      const body = res.json<{ claude_api: { last_check_at: string } }>();
      const parsed = new Date(body.claude_api.last_check_at);
      expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
    } finally {
      await app.close();
    }
  });

  it('should return 401 when the guard populates without a hotelId (defensive branch)', async () => {
    const repo = buildRepo();
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    await app.register(channelHealthRoutes, {
      repository: repo as unknown as ChannelHealthRepository,
      guards: [
        (_req, _reply, done) => {
          // populates neither hotelId nor throws — defensive branch check
          done();
        },
      ],
      clock: { now: () => NOW },
    });
    await app.ready();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/integrations/health' });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
