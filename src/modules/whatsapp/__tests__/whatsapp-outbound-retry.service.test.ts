/**
 * `WhatsappOutboundRetryService` unit tests. All 2 boundaries mocked at
 * class-shape level (repo, retryQueuePort). Discriminated union outcome
 * (`RetryScheduleOutcome`) — TypeScript proves per-variant field access
 * without any `as X` cast (T15/T13 precedent).
 */

import { describe, expect, it, jest } from '@jest/globals';

import { ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { RetryQueuePort } from '../ports/retry-queue.port.js';
import type { WhatsappOutboundRetryRepository } from '../whatsapp-outbound-retry.repository.js';
import { WhatsappOutboundRetryService } from '../whatsapp-outbound-retry.service.js';

const DISPATCH_ID = '00000000-0000-4000-8000-000000000001';
const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const JOB_ID = 'bull-job-abc123';

const PLAINTEXT_SECRETS = ['accessTokenSecret_xyz', '+6281234567890', 'Halo confidential body'];

interface RepoDouble {
  markRetryScheduled: jest.Mock;
  markPermanentFail: jest.Mock;
}
interface QueueDouble {
  enqueueRetry: jest.Mock;
}

function createRepoDouble(): {
  repo: WhatsappOutboundRetryRepository;
  double: RepoDouble;
} {
  const double: RepoDouble = {
    markRetryScheduled: jest.fn(),
    markPermanentFail: jest.fn(),
  };
  return { repo: double as unknown as WhatsappOutboundRetryRepository, double };
}

function createQueueDouble(): { port: RetryQueuePort; double: QueueDouble } {
  const double: QueueDouble = { enqueueRetry: jest.fn() };
  return { port: double as unknown as RetryQueuePort, double };
}

function createLoggerSpy(): Logger & {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
} {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function buildHappyMocks() {
  const { repo, double: repoDouble } = createRepoDouble();
  const { port: queue, double: queueDouble } = createQueueDouble();
  repoDouble.markRetryScheduled.mockResolvedValue(undefined);
  repoDouble.markPermanentFail.mockResolvedValue(undefined);
  queueDouble.enqueueRetry.mockResolvedValue({ jobId: JOB_ID });
  return { repo, queue, repoDouble, queueDouble };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    dispatchId: DISPATCH_ID,
    hotelId: HOTEL_ID,
    attemptsMade: 0,
    ...overrides,
  };
}

describe('WhatsappOutboundRetryService.scheduleRetryFromMetaFailure — schema failure', () => {
  it('should throw ValidationError when the input misses required fields', async () => {
    const { repo, queue } = buildHappyMocks();
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    await expect(
      service.scheduleRetryFromMetaFailure({ dispatchId: DISPATCH_ID }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('WhatsappOutboundRetryService.scheduleRetryFromMetaFailure — permanent classification', () => {
  it('should mark permanent with reason=quota_exhausted on 429 and NOT enqueue a retry', async () => {
    const { repo, queue, repoDouble, queueDouble } = buildHappyMocks();
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    const outcome = await service.scheduleRetryFromMetaFailure(
      baseInput({ status: 429, body: { rate_limit: true } }),
    );

    expect(outcome.kind).toBe('permanent');
    if (outcome.kind === 'permanent') {
      expect(outcome.reason).toBe('quota_exhausted');
    }
    expect(repoDouble.markPermanentFail).toHaveBeenCalledTimes(1);
    expect(queueDouble.enqueueRetry).not.toHaveBeenCalled();
  });

  it('should mark permanent with reason=auth_failed on 401 and NOT enqueue', async () => {
    const { repo, queue, repoDouble, queueDouble } = buildHappyMocks();
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    const outcome = await service.scheduleRetryFromMetaFailure(baseInput({ status: 401 }));

    expect(outcome.kind).toBe('permanent');
    if (outcome.kind === 'permanent') {
      expect(outcome.reason).toBe('auth_failed');
    }
    expect(queueDouble.enqueueRetry).not.toHaveBeenCalled();
    expect(repoDouble.markPermanentFail).toHaveBeenCalledTimes(1);
  });

  it('should mark permanent with reason=bad_request on 400 and NOT enqueue', async () => {
    const { repo, queue, repoDouble, queueDouble } = buildHappyMocks();
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    const outcome = await service.scheduleRetryFromMetaFailure(baseInput({ status: 400 }));

    expect(outcome.kind).toBe('permanent');
    if (outcome.kind === 'permanent') {
      expect(outcome.reason).toBe('bad_request');
    }
    expect(repoDouble.markPermanentFail).toHaveBeenCalledTimes(1);
    expect(queueDouble.enqueueRetry).not.toHaveBeenCalled();
  });
});

describe('WhatsappOutboundRetryService.scheduleRetryFromMetaFailure — retryable + under cap', () => {
  it('should enqueue attemptNumber=1 when the initial dispatch (attemptsMade=0) returns 500', async () => {
    const { repo, queue, repoDouble, queueDouble } = buildHappyMocks();
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    const outcome = await service.scheduleRetryFromMetaFailure(
      baseInput({ status: 500, attemptsMade: 0 }),
    );

    expect(outcome.kind).toBe('scheduled');
    if (outcome.kind === 'scheduled') {
      expect(outcome.attemptNumber).toBe(1);
      expect(outcome.jobId).toBe(JOB_ID);
    }
    expect(queueDouble.enqueueRetry).toHaveBeenCalledWith({
      dispatchId: DISPATCH_ID,
      hotelId: HOTEL_ID,
      attemptNumber: 1,
    });
    expect(repoDouble.markRetryScheduled).toHaveBeenCalledWith(DISPATCH_ID, 1);
  });

  it('should enqueue attemptNumber=2 when attemptsMade=1 and status is undefined (network error)', async () => {
    const { repo, queue, queueDouble, repoDouble } = buildHappyMocks();
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    const outcome = await service.scheduleRetryFromMetaFailure(baseInput({ attemptsMade: 1 }));

    expect(outcome.kind).toBe('scheduled');
    if (outcome.kind === 'scheduled') {
      expect(outcome.attemptNumber).toBe(2);
    }
    expect(queueDouble.enqueueRetry).toHaveBeenCalledWith({
      dispatchId: DISPATCH_ID,
      hotelId: HOTEL_ID,
      attemptNumber: 2,
    });
    expect(repoDouble.markRetryScheduled).toHaveBeenCalledWith(DISPATCH_ID, 2);
  });
});

describe('WhatsappOutboundRetryService.scheduleRetryFromMetaFailure — cap enforcement', () => {
  it('should return permanent reason=exhausted when attemptsMade=2 and status=500 (next attempt would be 3rd)', async () => {
    const { repo, queue, repoDouble, queueDouble } = buildHappyMocks();
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    const outcome = await service.scheduleRetryFromMetaFailure(
      baseInput({ status: 500, attemptsMade: 2 }),
    );

    expect(outcome.kind).toBe('permanent');
    if (outcome.kind === 'permanent') {
      expect(outcome.reason).toBe('exhausted');
    }
    expect(queueDouble.enqueueRetry).not.toHaveBeenCalled();
    expect(repoDouble.markPermanentFail).toHaveBeenCalledTimes(1);
  });

  it('should return permanent reason=exhausted when attemptsMade=3 regardless of status classification', async () => {
    const { repo, queue, queueDouble } = buildHappyMocks();
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    const outcome = await service.scheduleRetryFromMetaFailure(
      baseInput({ status: 500, attemptsMade: 3 }),
    );

    expect(outcome.kind).toBe('permanent');
    if (outcome.kind === 'permanent') {
      expect(outcome.reason).toBe('exhausted');
    }
    expect(queueDouble.enqueueRetry).not.toHaveBeenCalled();
  });

  it('should return permanent reason=exhausted with no status field when attemptsMade=2 and the input status is undefined (network error at cap edge)', async () => {
    const { repo, queue, repoDouble } = buildHappyMocks();
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    const outcome = await service.scheduleRetryFromMetaFailure(baseInput({ attemptsMade: 2 }));

    expect(outcome.kind).toBe('permanent');
    if (outcome.kind === 'permanent') {
      expect(outcome.reason).toBe('exhausted');
    }
    expect(repoDouble.markPermanentFail).toHaveBeenCalledTimes(1);
    const persistArg = repoDouble.markPermanentFail.mock.calls[0]?.[1] as {
      reason: string;
      status?: number;
      body?: unknown;
    };
    expect(persistArg.reason).toBe('exhausted');
    expect('status' in persistArg).toBe(false);
    expect('body' in persistArg).toBe(false);
  });

  it('should schedule (not exhausted) when attemptsMade=1 and status=502 (contrast to cap edge)', async () => {
    const { repo, queue, queueDouble } = buildHappyMocks();
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    const outcome = await service.scheduleRetryFromMetaFailure(
      baseInput({ status: 502, attemptsMade: 1 }),
    );

    expect(outcome.kind).toBe('scheduled');
    if (outcome.kind === 'scheduled') {
      expect(outcome.attemptNumber).toBe(2);
    }
    expect(queueDouble.enqueueRetry).toHaveBeenCalledTimes(1);
  });
});

describe('WhatsappOutboundRetryService.scheduleRetryFromMetaFailure — worker discipline', () => {
  it('should return permanent exhausted when queue enqueueRetry itself rejects (external failure never throws)', async () => {
    const { repo, queue, queueDouble, repoDouble } = buildHappyMocks();
    queueDouble.enqueueRetry.mockRejectedValue(new Error('Redis down'));
    const logger = createLoggerSpy();
    const service = new WhatsappOutboundRetryService(repo, queue, logger);

    const outcome = await service.scheduleRetryFromMetaFailure(
      baseInput({ status: 500, attemptsMade: 0 }),
    );

    expect(outcome.kind).toBe('permanent');
    if (outcome.kind === 'permanent') {
      expect(outcome.reason).toBe('exhausted');
    }
    expect(repoDouble.markPermanentFail).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should NOT throw when queue enqueueRetry rejects with a non-Error value', async () => {
    const { repo, queue, queueDouble } = buildHappyMocks();
    queueDouble.enqueueRetry.mockRejectedValue('boom');
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    await expect(
      service.scheduleRetryFromMetaFailure(baseInput({ status: 500, attemptsMade: 0 })),
    ).resolves.toEqual(expect.objectContaining({ kind: 'permanent', reason: 'exhausted' }));
  });

  it('should still return scheduled outcome when repo.markRetryScheduled itself rejects (queue was enqueued)', async () => {
    const { repo, queue, repoDouble } = buildHappyMocks();
    repoDouble.markRetryScheduled.mockRejectedValue(new Error('DB write failed'));
    const logger = createLoggerSpy();
    const service = new WhatsappOutboundRetryService(repo, queue, logger);

    const outcome = await service.scheduleRetryFromMetaFailure(
      baseInput({ status: 500, attemptsMade: 0 }),
    );

    expect(outcome.kind).toBe('scheduled');
    if (outcome.kind === 'scheduled') {
      expect(outcome.jobId).toBe(JOB_ID);
    }
    expect(logger.error).toHaveBeenCalled();
  });

  it('should still return permanent outcome when repo.markPermanentFail itself rejects', async () => {
    const { repo, queue, repoDouble } = buildHappyMocks();
    repoDouble.markPermanentFail.mockRejectedValue(new Error('DB write failed'));
    const logger = createLoggerSpy();
    const service = new WhatsappOutboundRetryService(repo, queue, logger);

    const outcome = await service.scheduleRetryFromMetaFailure(baseInput({ status: 429 }));

    expect(outcome.kind).toBe('permanent');
    if (outcome.kind === 'permanent') {
      expect(outcome.reason).toBe('quota_exhausted');
    }
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('WhatsappOutboundRetryService.scheduleRetryFromMetaFailure — PII floor + minimal job payload', () => {
  it('should send ONLY dispatchId + hotelId + attemptNumber in the Bull job payload (T07 factory minimal-context mandate)', async () => {
    const { repo, queue, queueDouble } = buildHappyMocks();
    const service = new WhatsappOutboundRetryService(repo, queue, createLoggerSpy());

    await service.scheduleRetryFromMetaFailure(
      baseInput({ status: 500, body: { secret: PLAINTEXT_SECRETS[0] } }),
    );

    const enqueueArg = queueDouble.enqueueRetry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(enqueueArg).sort()).toEqual(['attemptNumber', 'dispatchId', 'hotelId']);
    expect(enqueueArg.attemptNumber).toBe(1);
  });

  it('should NOT include plaintext secrets (accessToken / phone / body content) in ANY log payload (defense-in-depth)', async () => {
    const { repo, queue } = buildHappyMocks();
    const logger = createLoggerSpy();
    const service = new WhatsappOutboundRetryService(repo, queue, logger);

    await service.scheduleRetryFromMetaFailure(
      baseInput({
        status: 500,
        body: {
          token: PLAINTEXT_SECRETS[0],
          phone: PLAINTEXT_SECRETS[1],
          text: PLAINTEXT_SECRETS[2],
        },
      }),
    );

    const allLogs = [
      ...logger.info.mock.calls,
      ...logger.warn.mock.calls,
      ...logger.debug.mock.calls,
      ...logger.error.mock.calls,
    ];
    for (const call of allLogs) {
      const serialized = JSON.stringify(call[0]);
      for (const secret of PLAINTEXT_SECRETS) {
        expect(serialized).not.toContain(secret);
      }
    }
  });

  it('should keep the attempt-level log payload compact (dispatchId + hotelId + attemptsMade + hasStatus only)', async () => {
    const { repo, queue } = buildHappyMocks();
    const logger = createLoggerSpy();
    const service = new WhatsappOutboundRetryService(repo, queue, logger);

    await service.scheduleRetryFromMetaFailure(baseInput({ status: 500, attemptsMade: 0 }));

    const attemptLog = logger.info.mock.calls.find((call) => {
      const entry = call[0] as { msg?: string };
      return entry?.msg === 'whatsapp_outbound_retry.attempt';
    });
    expect(attemptLog).toBeDefined();
    const logged = attemptLog?.[0] as Record<string, unknown>;
    expect(JSON.stringify(logged).length).toBeLessThan(500);
    expect(Object.keys(logged).sort()).toEqual([
      'attemptsMade',
      'dispatchId',
      'hasStatus',
      'hotelId',
      'module',
      'msg',
    ]);
  });
});
