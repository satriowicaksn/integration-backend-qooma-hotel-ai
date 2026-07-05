/**
 * Repository call-shape unit tests. Prisma-mock stopgap per T10/T11/T12/T13/
 * T15/T16 precedent (7× cross-primitive now); T14-INTEG parked pending
 * Q-C-01 + T14-followup.
 *
 * Repository has EXACTLY 2 methods per PM B ACK binding condition #4:
 * `markRetryScheduled` + `markPermanentFail`.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';

import { WhatsappOutboundRetryRepository } from '../whatsapp-outbound-retry.repository.js';

const DISPATCH_ID = '00000000-0000-4000-8000-000000000001';

interface PrismaTestDouble {
  outboundDispatch: { update: jest.Mock };
}

function createPrismaDouble(): { db: PrismaClient; double: PrismaTestDouble } {
  const double: PrismaTestDouble = {
    outboundDispatch: { update: jest.fn() },
  };
  return { db: double as unknown as PrismaClient, double };
}

describe('WhatsappOutboundRetryRepository.markRetryScheduled', () => {
  let db: PrismaClient;
  let double: PrismaTestDouble;
  let repo: WhatsappOutboundRetryRepository;

  beforeEach(() => {
    ({ db, double } = createPrismaDouble());
    repo = new WhatsappOutboundRetryRepository(db);
  });

  it('should call Prisma update keyed by dispatchId with attempts bumped to the given count', async () => {
    double.outboundDispatch.update.mockResolvedValue({});

    await repo.markRetryScheduled(DISPATCH_ID, 2);

    expect(double.outboundDispatch.update).toHaveBeenCalledWith({
      where: { id: DISPATCH_ID },
      data: { attempts: 2 },
    });
  });
});

describe('WhatsappOutboundRetryRepository.markPermanentFail', () => {
  let db: PrismaClient;
  let double: PrismaTestDouble;
  let repo: WhatsappOutboundRetryRepository;

  beforeEach(() => {
    ({ db, double } = createPrismaDouble());
    repo = new WhatsappOutboundRetryRepository(db);
  });

  it('should set status=failed and persist reason + status + string body verbatim to last_error', async () => {
    double.outboundDispatch.update.mockResolvedValue({});

    await repo.markPermanentFail(DISPATCH_ID, {
      reason: 'auth_failed',
      status: 401,
      body: 'Invalid access token',
    });

    expect(double.outboundDispatch.update).toHaveBeenCalledWith({
      where: { id: DISPATCH_ID },
      data: {
        status: 'failed',
        lastError: {
          reason: 'auth_failed',
          status: 401,
          body: 'Invalid access token',
        },
      },
    });
  });

  it('should JSON.stringify a non-string body when persisting last_error', async () => {
    double.outboundDispatch.update.mockResolvedValue({});

    await repo.markPermanentFail(DISPATCH_ID, {
      reason: 'template_rejected',
      status: 422,
      body: { error: { code: 'INVALID_TEMPLATE' } },
    });

    const call = double.outboundDispatch.update.mock.calls[0]?.[0] as {
      data: { lastError: { body: string } };
    };
    expect(typeof call.data.lastError.body).toBe('string');
    expect(call.data.lastError.body).toContain('INVALID_TEMPLATE');
  });

  it('should omit status and body fields when they are undefined', async () => {
    double.outboundDispatch.update.mockResolvedValue({});

    await repo.markPermanentFail(DISPATCH_ID, { reason: 'exhausted' });

    const call = double.outboundDispatch.update.mock.calls[0]?.[0] as {
      data: { lastError: Record<string, unknown> };
    };
    expect(call.data.lastError).toEqual({ reason: 'exhausted' });
    expect('status' in call.data.lastError).toBe(false);
    expect('body' in call.data.lastError).toBe(false);
  });

  it('should coerce a circular body reference to a String() representation without throwing', async () => {
    double.outboundDispatch.update.mockResolvedValue({});
    const circular: Record<string, unknown> = { name: 'circular' };
    circular.self = circular;

    await repo.markPermanentFail(DISPATCH_ID, {
      reason: 'bad_request',
      status: 400,
      body: circular,
    });

    const call = double.outboundDispatch.update.mock.calls[0]?.[0] as {
      data: { lastError: { body: string } };
    };
    expect(typeof call.data.lastError.body).toBe('string');
  });
});
