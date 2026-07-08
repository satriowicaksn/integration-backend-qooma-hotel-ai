import { describe, expect, it, jest } from '@jest/globals';

import { NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { DepartmentTelegramReadPort } from '../ports/department-telegram-read.port.js';
import type {
  DepartmentTelegramWritePort,
  DepartmentTelegramWriteResult,
} from '../ports/department-telegram-write.port.js';
import { TelegramDeptRoutingService } from '../telegram-dept-routing.service.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const OTHER_HOTEL_ID = '99999999-9999-9999-9999-999999999999';
const DEPT_ID = 'dept-hk-01';
const CHAT_ID_FULL = '-1001234567890';
const SUPERVISOR_ID_FULL = '987654321';
const NOW = new Date('2026-07-08T09:30:00.000Z');

interface ReadMock {
  getForTenantCheck: jest.Mock<DepartmentTelegramReadPort['getForTenantCheck']>;
}

interface WriteMock {
  updateRouting: jest.Mock<
    (input: {
      deptId: string;
      telegramChatId?: string;
      supervisorTelegramId?: string;
    }) => Promise<DepartmentTelegramWriteResult>
  >;
}

interface LoggerMock extends Logger {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

function buildLogger(): LoggerMock {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function buildService(): {
  service: TelegramDeptRoutingService;
  deptRead: ReadMock;
  deptWrite: WriteMock;
  logger: LoggerMock;
} {
  const deptRead: ReadMock = {
    getForTenantCheck: jest.fn<DepartmentTelegramReadPort['getForTenantCheck']>(),
  };
  const deptWrite: WriteMock = {
    updateRouting:
      jest.fn<
        (input: {
          deptId: string;
          telegramChatId?: string;
          supervisorTelegramId?: string;
        }) => Promise<DepartmentTelegramWriteResult>
      >(),
  };
  const logger = buildLogger();
  const service = new TelegramDeptRoutingService(
    {
      deptRead: deptRead as unknown as DepartmentTelegramReadPort,
      deptWrite: deptWrite as unknown as DepartmentTelegramWritePort,
    },
    logger,
    { now: () => NOW },
  );
  return { service, deptRead, deptWrite, logger };
}

describe('TelegramDeptRoutingService.updateRouting — happy path', () => {
  it('should verify tenancy, write both routing fields, and return { updated, updatedAt } when both fields present', async () => {
    const { service, deptRead, deptWrite } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: HOTEL_ID });
    deptWrite.updateRouting.mockResolvedValue({ updated: true });

    const result = await service.updateRouting({
      hotelId: HOTEL_ID,
      deptId: DEPT_ID,
      telegramChatId: CHAT_ID_FULL,
      supervisorTelegramId: SUPERVISOR_ID_FULL,
    });

    expect(deptRead.getForTenantCheck).toHaveBeenCalledWith({ deptId: DEPT_ID });
    expect(deptWrite.updateRouting).toHaveBeenCalledWith({
      deptId: DEPT_ID,
      telegramChatId: CHAT_ID_FULL,
      supervisorTelegramId: SUPERVISOR_ID_FULL,
    });
    expect(result).toEqual({ updated: true, updatedAt: NOW });
  });

  it('should pass through telegramChatId only when supervisor is omitted', async () => {
    const { service, deptRead, deptWrite } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: HOTEL_ID });
    deptWrite.updateRouting.mockResolvedValue({ updated: true });

    await service.updateRouting({
      hotelId: HOTEL_ID,
      deptId: DEPT_ID,
      telegramChatId: CHAT_ID_FULL,
    });

    const call = deptWrite.updateRouting.mock.calls[0]?.[0];
    expect(call).toEqual({ deptId: DEPT_ID, telegramChatId: CHAT_ID_FULL });
    expect(call).not.toHaveProperty('supervisorTelegramId');
  });

  it('should pass through supervisorTelegramId only when chat is omitted', async () => {
    const { service, deptRead, deptWrite } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: HOTEL_ID });
    deptWrite.updateRouting.mockResolvedValue({ updated: true });

    await service.updateRouting({
      hotelId: HOTEL_ID,
      deptId: DEPT_ID,
      supervisorTelegramId: SUPERVISOR_ID_FULL,
    });

    const call = deptWrite.updateRouting.mock.calls[0]?.[0];
    expect(call).toEqual({ deptId: DEPT_ID, supervisorTelegramId: SUPERVISOR_ID_FULL });
    expect(call).not.toHaveProperty('telegramChatId');
  });
});

describe('TelegramDeptRoutingService.updateRouting — §4.10 enumeration guard', () => {
  it('should throw NotFoundError when the reader port returns null (dept does not exist)', async () => {
    const { service, deptRead, deptWrite } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue(null);

    await expect(
      service.updateRouting({
        hotelId: HOTEL_ID,
        deptId: DEPT_ID,
        telegramChatId: CHAT_ID_FULL,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      service.updateRouting({
        hotelId: HOTEL_ID,
        deptId: DEPT_ID,
        telegramChatId: CHAT_ID_FULL,
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { resource: 'department', id: DEPT_ID },
    });
    expect(deptWrite.updateRouting).not.toHaveBeenCalled();
  });

  it('should throw the SAME NotFoundError shape on cross-tenant attempt (§4.10 no enumeration)', async () => {
    const { service, deptRead, deptWrite } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: OTHER_HOTEL_ID });

    const promise = service.updateRouting({
      hotelId: HOTEL_ID,
      deptId: DEPT_ID,
      telegramChatId: CHAT_ID_FULL,
    });

    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    await expect(promise).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      details: { resource: 'department', id: DEPT_ID },
    });
    expect(deptWrite.updateRouting).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the writer signals notFound (race: dept deleted between check and write)', async () => {
    const { service, deptRead, deptWrite } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: HOTEL_ID });
    deptWrite.updateRouting.mockResolvedValue({ notFound: true });

    await expect(
      service.updateRouting({
        hotelId: HOTEL_ID,
        deptId: DEPT_ID,
        telegramChatId: CHAT_ID_FULL,
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { resource: 'department', id: DEPT_ID },
    });
  });
});

describe('TelegramDeptRoutingService.updateRouting — PII discipline', () => {
  it('should log telegramChatIdSuffix (last 4 chars) and NEVER the full chatId', async () => {
    const { service, deptRead, deptWrite, logger } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: HOTEL_ID });
    deptWrite.updateRouting.mockResolvedValue({ updated: true });

    await service.updateRouting({
      hotelId: HOTEL_ID,
      deptId: DEPT_ID,
      telegramChatId: CHAT_ID_FULL,
    });

    const record = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record['telegramChatIdSuffix']).toBe(CHAT_ID_FULL.slice(-4));
    expect(JSON.stringify(record)).not.toContain(CHAT_ID_FULL);
  });

  it('should log supervisorTelegramIdSuffix (last 4 chars) and NEVER the full supervisor id', async () => {
    const { service, deptRead, deptWrite, logger } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: HOTEL_ID });
    deptWrite.updateRouting.mockResolvedValue({ updated: true });

    await service.updateRouting({
      hotelId: HOTEL_ID,
      deptId: DEPT_ID,
      supervisorTelegramId: SUPERVISOR_ID_FULL,
    });

    const record = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record['supervisorTelegramIdSuffix']).toBe(SUPERVISOR_ID_FULL.slice(-4));
    expect(JSON.stringify(record)).not.toContain(SUPERVISOR_ID_FULL);
  });

  it('should omit routing suffix fields from the log when the input omits them', async () => {
    const { service, deptRead, deptWrite, logger } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: HOTEL_ID });
    deptWrite.updateRouting.mockResolvedValue({ updated: true });

    await service.updateRouting({
      hotelId: HOTEL_ID,
      deptId: DEPT_ID,
      telegramChatId: CHAT_ID_FULL,
    });

    const record = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record).not.toHaveProperty('supervisorTelegramIdSuffix');
  });
});

describe('TelegramDeptRoutingService.updateRouting — clock injection', () => {
  it('should return updatedAt equal to the injected clock reading', async () => {
    const { service, deptRead, deptWrite } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: HOTEL_ID });
    deptWrite.updateRouting.mockResolvedValue({ updated: true });

    const result = await service.updateRouting({
      hotelId: HOTEL_ID,
      deptId: DEPT_ID,
      telegramChatId: CHAT_ID_FULL,
    });

    expect(result.updatedAt).toBe(NOW);
  });

  it('should fall back to SYSTEM_CLOCK.now() (real wall clock) when no clock is injected (binding #9 default)', async () => {
    const deptRead: ReadMock = {
      getForTenantCheck: jest.fn<DepartmentTelegramReadPort['getForTenantCheck']>(),
    };
    const deptWrite: WriteMock = {
      updateRouting:
        jest.fn<
          (input: {
            deptId: string;
            telegramChatId?: string;
            supervisorTelegramId?: string;
          }) => Promise<DepartmentTelegramWriteResult>
        >(),
    };
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: HOTEL_ID });
    deptWrite.updateRouting.mockResolvedValue({ updated: true });
    const service = new TelegramDeptRoutingService(
      {
        deptRead: deptRead as unknown as DepartmentTelegramReadPort,
        deptWrite: deptWrite as unknown as DepartmentTelegramWritePort,
      },
      buildLogger(),
    );

    const before = new Date();
    const result = await service.updateRouting({
      hotelId: HOTEL_ID,
      deptId: DEPT_ID,
      telegramChatId: CHAT_ID_FULL,
    });
    const after = new Date();

    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('TelegramDeptRoutingService.updateRouting — order of operations (binding #5)', () => {
  it('should call deptRead.getForTenantCheck BEFORE deptWrite.updateRouting on the happy path', async () => {
    const { service, deptRead, deptWrite } = buildService();
    const callOrder: string[] = [];
    deptRead.getForTenantCheck.mockImplementation(() => {
      callOrder.push('read');
      return Promise.resolve({ hotelId: HOTEL_ID });
    });
    deptWrite.updateRouting.mockImplementation(() => {
      callOrder.push('write');
      return Promise.resolve({ updated: true });
    });

    await service.updateRouting({
      hotelId: HOTEL_ID,
      deptId: DEPT_ID,
      telegramChatId: CHAT_ID_FULL,
    });

    expect(callOrder).toEqual(['read', 'write']);
  });

  it('should NOT invoke deptWrite when tenancy check throws (fail-closed on §4.10 guard)', async () => {
    const { service, deptRead, deptWrite } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: OTHER_HOTEL_ID });

    await expect(
      service.updateRouting({
        hotelId: HOTEL_ID,
        deptId: DEPT_ID,
        telegramChatId: CHAT_ID_FULL,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(deptWrite.updateRouting).not.toHaveBeenCalled();
  });

  it('should NOT invoke logger when the tenancy check fails (no leak of attempt metadata)', async () => {
    const { service, deptRead, logger } = buildService();
    deptRead.getForTenantCheck.mockResolvedValue({ hotelId: OTHER_HOTEL_ID });

    await expect(
      service.updateRouting({
        hotelId: HOTEL_ID,
        deptId: DEPT_ID,
        telegramChatId: CHAT_ID_FULL,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(logger.info).not.toHaveBeenCalled();
  });
});

describe('TelegramDeptRoutingService.updateRouting — §4.10 byte-identical NotFoundError shape (binding #6)', () => {
  it('should throw exactly the same code / statusCode / message / details for null-dept and cross-tenant', async () => {
    const { service: svc1, deptRead: read1 } = buildService();
    read1.getForTenantCheck.mockResolvedValue(null);

    const { service: svc2, deptRead: read2 } = buildService();
    read2.getForTenantCheck.mockResolvedValue({ hotelId: OTHER_HOTEL_ID });

    const errNull = await svc1
      .updateRouting({
        hotelId: HOTEL_ID,
        deptId: DEPT_ID,
        telegramChatId: CHAT_ID_FULL,
      })
      .catch((e: unknown) => e);
    const errCross = await svc2
      .updateRouting({
        hotelId: HOTEL_ID,
        deptId: DEPT_ID,
        telegramChatId: CHAT_ID_FULL,
      })
      .catch((e: unknown) => e);

    expect(errNull).toBeInstanceOf(NotFoundError);
    expect(errCross).toBeInstanceOf(NotFoundError);
    const a = errNull as NotFoundError;
    const b = errCross as NotFoundError;
    expect(a.code).toBe(b.code);
    expect(a.statusCode).toBe(b.statusCode);
    expect(a.message).toBe(b.message);
    expect(a.details).toEqual(b.details);
  });
});
