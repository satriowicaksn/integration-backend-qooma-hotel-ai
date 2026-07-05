/**
 * `WhatsappOutboundDispatchService` unit tests. All 4 boundaries mocked at
 * class-shape level (repo, bspPort, quotaPort, dndPort). Discriminated union
 * outcome (`OutboundDispatchOutcome`) — TypeScript proves per-variant field
 * access without any `as X` cast (T15 precedent).
 */

import { describe, expect, it, jest } from '@jest/globals';

import { ExternalServiceError, NotFoundError, ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { maskWaPhone } from '@shared/utils/masking.js';

import type { HotelCoreDndPort } from '../ports/hotel-core-dnd.port.js';
import type { HotelCoreQuotaPort } from '../ports/hotel-core-quota.port.js';
import type { WhatsappBspPort } from '../ports/whatsapp-bsp.port.js';
import type { WhatsappOutboundDispatchRepository } from '../whatsapp-outbound-dispatch.repository.js';
import { WhatsappOutboundDispatchService } from '../whatsapp-outbound-dispatch.service.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const GUEST_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const DISPATCH_ID = 'cccccccc-dddd-eeee-ffff-000000000001';
const RESERVATION_ID = 'reservation-abc';
const EXTERNAL_ID = 'wamid.msg1';
const RECIPIENT = '628123456789';
const PLAINTEXT_TOKEN = 'super-secret-access-token-1234567';

const configForDispatch = {
  bsp: '1engage',
  phoneNumberId: 'phone-123',
  accessTokenPlaintext: PLAINTEXT_TOKEN,
};

const textRequest = {
  hotelId: HOTEL_ID,
  guestId: GUEST_ID,
  recipientPhone: RECIPIENT,
  body: 'Halo, welcome!',
};

const templateRequest = {
  hotelId: HOTEL_ID,
  guestId: GUEST_ID,
  recipientPhone: RECIPIENT,
  template: {
    name: 'welcome_template',
    languageCode: 'id',
    variables: ['Nanak', 'Room 101'],
  },
};

interface RepoDouble {
  findConfigForDispatch: jest.Mock;
  persistPending: jest.Mock;
  markSent: jest.Mock;
  markFailed: jest.Mock;
}
interface BspDouble {
  sendText: jest.Mock;
  sendTemplate: jest.Mock;
}
interface QuotaDouble {
  checkAndReserve: jest.Mock;
  commit: jest.Mock;
  rollback: jest.Mock;
}
interface DndDouble {
  isDndForRecipient: jest.Mock;
}

function createRepoDouble(): {
  repo: WhatsappOutboundDispatchRepository;
  double: RepoDouble;
} {
  const double: RepoDouble = {
    findConfigForDispatch: jest.fn(),
    persistPending: jest.fn(),
    markSent: jest.fn(),
    markFailed: jest.fn(),
  };
  return { repo: double as unknown as WhatsappOutboundDispatchRepository, double };
}

function createBspDouble(): { port: WhatsappBspPort; double: BspDouble } {
  const double: BspDouble = {
    sendText: jest.fn(),
    sendTemplate: jest.fn(),
  };
  return { port: double as unknown as WhatsappBspPort, double };
}

function createQuotaDouble(): { port: HotelCoreQuotaPort; double: QuotaDouble } {
  const double: QuotaDouble = {
    checkAndReserve: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
  };
  return { port: double as unknown as HotelCoreQuotaPort, double };
}

function createDndDouble(): { port: HotelCoreDndPort; double: DndDouble } {
  const double: DndDouble = {
    isDndForRecipient: jest.fn(),
  };
  return { port: double as unknown as HotelCoreDndPort, double };
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

function buildAllHappyMocks() {
  const { repo, double: repoDouble } = createRepoDouble();
  const { port: bspPort, double: bspDouble } = createBspDouble();
  const { port: quotaPort, double: quotaDouble } = createQuotaDouble();
  const { port: dndPort, double: dndDouble } = createDndDouble();
  repoDouble.findConfigForDispatch.mockResolvedValue(configForDispatch);
  repoDouble.persistPending.mockResolvedValue({ id: DISPATCH_ID });
  repoDouble.markSent.mockResolvedValue({});
  repoDouble.markFailed.mockResolvedValue({});
  dndDouble.isDndForRecipient.mockResolvedValue({ blocked: false, vvipExempt: false });
  quotaDouble.checkAndReserve.mockResolvedValue({ reserved: true, reservationId: RESERVATION_ID });
  quotaDouble.commit.mockResolvedValue(undefined);
  quotaDouble.rollback.mockResolvedValue(undefined);
  bspDouble.sendText.mockResolvedValue({ messageId: EXTERNAL_ID });
  bspDouble.sendTemplate.mockResolvedValue({ messageId: EXTERNAL_ID });
  return {
    repo,
    bspPort,
    quotaPort,
    dndPort,
    repoDouble,
    bspDouble,
    quotaDouble,
    dndDouble,
  };
}

describe('WhatsappOutboundDispatchService.dispatchMessage — happy paths', () => {
  it('should dispatch a text message via bspPort.sendText and return kind=dispatched with dispatchId + externalId', async () => {
    const { repo, bspPort, quotaPort, dndPort, repoDouble, bspDouble, quotaDouble } =
      buildAllHappyMocks();
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    const outcome = await service.dispatchMessage(textRequest);

    expect(outcome.kind).toBe('dispatched');
    if (outcome.kind === 'dispatched') {
      expect(outcome.dispatchId).toBe(DISPATCH_ID);
      expect(outcome.externalId).toBe(EXTERNAL_ID);
    }
    expect(bspDouble.sendText).toHaveBeenCalledTimes(1);
    expect(bspDouble.sendTemplate).not.toHaveBeenCalled();
    expect(repoDouble.markSent).toHaveBeenCalledWith(DISPATCH_ID, EXTERNAL_ID, expect.any(Date));
    expect(quotaDouble.commit).toHaveBeenCalledWith(RESERVATION_ID);
    expect(quotaDouble.rollback).not.toHaveBeenCalled();
  });

  it('should dispatch a template message via bspPort.sendTemplate when the request carries a template', async () => {
    const { repo, bspPort, quotaPort, dndPort, bspDouble, repoDouble } = buildAllHappyMocks();
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    const outcome = await service.dispatchMessage(templateRequest);

    expect(outcome.kind).toBe('dispatched');
    expect(bspDouble.sendTemplate).toHaveBeenCalledTimes(1);
    expect(bspDouble.sendText).not.toHaveBeenCalled();
    const sendArg = bspDouble.sendTemplate.mock.calls[0]?.[0] as {
      templateName: string;
      languageCode: string;
      variables?: string[];
    };
    expect(sendArg.templateName).toBe('welcome_template');
    expect(sendArg.languageCode).toBe('id');
    expect(sendArg.variables).toEqual(['Nanak', 'Room 101']);
    expect(repoDouble.persistPending).toHaveBeenCalledTimes(1);
  });

  it('should pass the plaintext accessToken from findConfigForDispatch verbatim into the BSP credentials', async () => {
    const { repo, bspPort, quotaPort, dndPort, bspDouble } = buildAllHappyMocks();
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    await service.dispatchMessage(textRequest);

    const sendArg = bspDouble.sendText.mock.calls[0]?.[0] as {
      credentials: { phoneNumberId: string; accessToken: string };
    };
    expect(sendArg.credentials.accessToken).toBe(PLAINTEXT_TOKEN);
    expect(sendArg.credentials.phoneNumberId).toBe('phone-123');
  });
});

describe('WhatsappOutboundDispatchService.dispatchMessage — template without variables', () => {
  it('should persist + send a template without any variables when the request omits the variables array', async () => {
    const { repo, bspPort, quotaPort, dndPort, bspDouble, repoDouble } = buildAllHappyMocks();
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    const outcome = await service.dispatchMessage({
      hotelId: HOTEL_ID,
      guestId: GUEST_ID,
      recipientPhone: RECIPIENT,
      template: { name: 'ping', languageCode: 'en' },
    });

    expect(outcome.kind).toBe('dispatched');
    const sendArg = bspDouble.sendTemplate.mock.calls[0]?.[0] as {
      templateName: string;
      variables?: string[];
    };
    expect(sendArg.templateName).toBe('ping');
    expect(sendArg.variables).toBeUndefined();
    const persistArg = repoDouble.persistPending.mock.calls[0]?.[0] as {
      templateName?: string;
      variables?: unknown;
    };
    expect(persistArg.templateName).toBe('ping');
    expect(persistArg.variables).toBeUndefined();
  });
});

describe('WhatsappOutboundDispatchService.dispatchMessage — Meta failure with string body upstream', () => {
  it('should carry the upstream string body verbatim into the meta_failed outcome', async () => {
    const { repo, bspPort, quotaPort, dndPort, bspDouble } = buildAllHappyMocks();
    bspDouble.sendText.mockRejectedValue(
      new ExternalServiceError('1engage', 'Meta returned 502', {
        status: 502,
        body: 'Bad Gateway from upstream',
      }),
    );
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    const outcome = await service.dispatchMessage(textRequest);

    expect(outcome.kind).toBe('meta_failed');
    if (outcome.kind === 'meta_failed') {
      expect(outcome.status).toBe(502);
      expect(outcome.body).toBe('Bad Gateway from upstream');
    }
  });
});

describe('WhatsappOutboundDispatchService.dispatchMessage — DND rejection', () => {
  it('should return kind=rejected_dnd + NOT persist + NOT reserve quota when DND blocks and vvipExempt=false', async () => {
    const { repo, bspPort, quotaPort, dndPort, dndDouble, repoDouble, quotaDouble } =
      buildAllHappyMocks();
    dndDouble.isDndForRecipient.mockResolvedValue({ blocked: true, vvipExempt: false });
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    const outcome = await service.dispatchMessage(textRequest);

    expect(outcome.kind).toBe('rejected_dnd');
    if (outcome.kind === 'rejected_dnd') {
      expect(outcome.reason).toBe('dnd_window_active');
    }
    expect(repoDouble.persistPending).not.toHaveBeenCalled();
    expect(quotaDouble.checkAndReserve).not.toHaveBeenCalled();
  });

  it('should BYPASS DND rejection and proceed to dispatch when blocked=true AND vvipExempt=true', async () => {
    const { repo, bspPort, quotaPort, dndPort, dndDouble, repoDouble, quotaDouble } =
      buildAllHappyMocks();
    dndDouble.isDndForRecipient.mockResolvedValue({ blocked: true, vvipExempt: true });
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    const outcome = await service.dispatchMessage(textRequest);

    expect(outcome.kind).toBe('dispatched');
    expect(repoDouble.persistPending).toHaveBeenCalledTimes(1);
    expect(quotaDouble.checkAndReserve).toHaveBeenCalledTimes(1);
    expect(quotaDouble.commit).toHaveBeenCalledWith(RESERVATION_ID);
  });
});

describe('WhatsappOutboundDispatchService.dispatchMessage — quota exhaustion', () => {
  it('should return kind=quota_exhausted + NOT persist when Phase-1 reserve refuses', async () => {
    const { repo, bspPort, quotaPort, dndPort, quotaDouble, repoDouble, bspDouble } =
      buildAllHappyMocks();
    quotaDouble.checkAndReserve.mockResolvedValue({
      reserved: false,
      reason: 'monthly_quota_100_percent',
    });
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    const outcome = await service.dispatchMessage(textRequest);

    expect(outcome.kind).toBe('quota_exhausted');
    if (outcome.kind === 'quota_exhausted') {
      expect(outcome.reason).toBe('monthly_quota_100_percent');
    }
    expect(repoDouble.persistPending).not.toHaveBeenCalled();
    expect(bspDouble.sendText).not.toHaveBeenCalled();
    expect(bspDouble.sendTemplate).not.toHaveBeenCalled();
    expect(quotaDouble.commit).not.toHaveBeenCalled();
    expect(quotaDouble.rollback).not.toHaveBeenCalled();
  });
});

describe('WhatsappOutboundDispatchService.dispatchMessage — Meta failure', () => {
  it('should return kind=meta_failed with dispatchId and rollback the quota reservation when BSP throws ExternalServiceError', async () => {
    const { repo, bspPort, quotaPort, dndPort, bspDouble, quotaDouble, repoDouble } =
      buildAllHappyMocks();
    bspDouble.sendText.mockRejectedValue(
      new ExternalServiceError('1engage', 'Meta returned 500', { status: 500, body: { err: 'x' } }),
    );
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    const outcome = await service.dispatchMessage(textRequest);

    expect(outcome.kind).toBe('meta_failed');
    if (outcome.kind === 'meta_failed') {
      expect(outcome.dispatchId).toBe(DISPATCH_ID);
      expect(outcome.status).toBe(500);
    }
    expect(quotaDouble.rollback).toHaveBeenCalledWith(RESERVATION_ID);
    expect(quotaDouble.commit).not.toHaveBeenCalled();
    expect(repoDouble.markFailed).toHaveBeenCalledTimes(1);
    expect(repoDouble.markSent).not.toHaveBeenCalled();
  });

  it('should NEVER throw when BSP rejects with a non-Error value (worker discipline)', async () => {
    const { repo, bspPort, quotaPort, dndPort, bspDouble } = buildAllHappyMocks();
    bspDouble.sendText.mockRejectedValue('boom');
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    await expect(service.dispatchMessage(textRequest)).resolves.toEqual(
      expect.objectContaining({ kind: 'meta_failed', dispatchId: DISPATCH_ID }),
    );
  });

  it('should NOT throw when the rollback itself fails (rollback discipline)', async () => {
    const { repo, bspPort, quotaPort, dndPort, bspDouble, quotaDouble } = buildAllHappyMocks();
    bspDouble.sendText.mockRejectedValue(new Error('Meta unreachable'));
    quotaDouble.rollback.mockRejectedValue(new Error('HC 502 on rollback'));
    const logger = createLoggerSpy();
    const service = new WhatsappOutboundDispatchService(repo, bspPort, quotaPort, dndPort, logger);

    await expect(service.dispatchMessage(textRequest)).resolves.toEqual(
      expect.objectContaining({ kind: 'meta_failed' }),
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('should NOT throw when markFailed itself fails (worker discipline)', async () => {
    const { repo, bspPort, quotaPort, dndPort, bspDouble, repoDouble } = buildAllHappyMocks();
    bspDouble.sendText.mockRejectedValue(new Error('Meta unreachable'));
    repoDouble.markFailed.mockRejectedValue(new Error('DB down'));
    const logger = createLoggerSpy();
    const service = new WhatsappOutboundDispatchService(repo, bspPort, quotaPort, dndPort, logger);

    await expect(service.dispatchMessage(textRequest)).resolves.toEqual(
      expect.objectContaining({ kind: 'meta_failed' }),
    );
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('WhatsappOutboundDispatchService.dispatchMessage — happy-path safety-net failures', () => {
  it('should NOT throw when markSent itself fails on a happy path (still returns dispatched)', async () => {
    const { repo, bspPort, quotaPort, dndPort, repoDouble } = buildAllHappyMocks();
    repoDouble.markSent.mockRejectedValue(new Error('DB down'));
    const logger = createLoggerSpy();
    const service = new WhatsappOutboundDispatchService(repo, bspPort, quotaPort, dndPort, logger);

    const outcome = await service.dispatchMessage(textRequest);

    expect(outcome.kind).toBe('dispatched');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should NOT throw when quotaPort.commit itself fails on a happy path (still returns dispatched)', async () => {
    const { repo, bspPort, quotaPort, dndPort, quotaDouble } = buildAllHappyMocks();
    quotaDouble.commit.mockRejectedValue(new Error('HC quota commit 502'));
    const logger = createLoggerSpy();
    const service = new WhatsappOutboundDispatchService(repo, bspPort, quotaPort, dndPort, logger);

    const outcome = await service.dispatchMessage(textRequest);

    expect(outcome.kind).toBe('dispatched');
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('WhatsappOutboundDispatchService.dispatchMessage — propagated errors', () => {
  it('should throw ValidationError when the request fails schema parse', async () => {
    const { repo, bspPort, quotaPort, dndPort } = buildAllHappyMocks();
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    await expect(
      service.dispatchMessage({ hotelId: 'not-uuid', body: 'x' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('should propagate NotFoundError when no wa_config exists for the hotel', async () => {
    const { repo, bspPort, quotaPort, dndPort, repoDouble, dndDouble } = buildAllHappyMocks();
    repoDouble.findConfigForDispatch.mockResolvedValue(null);
    const service = new WhatsappOutboundDispatchService(
      repo,
      bspPort,
      quotaPort,
      dndPort,
      createLoggerSpy(),
    );

    await expect(service.dispatchMessage(textRequest)).rejects.toBeInstanceOf(NotFoundError);
    expect(dndDouble.isDndForRecipient).not.toHaveBeenCalled();
  });
});

describe('WhatsappOutboundDispatchService.dispatchMessage — PII floor', () => {
  it('should mask recipientPhone in the attempt-level log and NOT leak the plaintext phone or accessToken', async () => {
    const { repo, bspPort, quotaPort, dndPort } = buildAllHappyMocks();
    const logger = createLoggerSpy();
    const service = new WhatsappOutboundDispatchService(repo, bspPort, quotaPort, dndPort, logger);

    await service.dispatchMessage(textRequest);

    const attemptLog = logger.info.mock.calls.find((c) => {
      const entry = c[0] as { msg?: string };
      return entry?.msg === 'whatsapp_outbound_dispatch.attempt';
    });
    expect(attemptLog).toBeDefined();
    const logged = attemptLog?.[0] as Record<string, unknown>;
    expect(logged.recipientPhone).toBe(maskWaPhone(RECIPIENT));
    const serialized = JSON.stringify(logged);
    expect(serialized).not.toContain(RECIPIENT);
    expect(serialized).not.toContain(PLAINTEXT_TOKEN);
    expect(serialized.length).toBeLessThan(500);
  });

  it('should NOT include the plaintext accessToken in ANY log payload across the full happy-path (defense-in-depth)', async () => {
    const { repo, bspPort, quotaPort, dndPort } = buildAllHappyMocks();
    const logger = createLoggerSpy();
    const service = new WhatsappOutboundDispatchService(repo, bspPort, quotaPort, dndPort, logger);

    await service.dispatchMessage(textRequest);

    const allLogs = [
      ...logger.info.mock.calls,
      ...logger.warn.mock.calls,
      ...logger.debug.mock.calls,
      ...logger.error.mock.calls,
    ];
    for (const call of allLogs) {
      expect(JSON.stringify(call[0])).not.toContain(PLAINTEXT_TOKEN);
    }
  });
});
