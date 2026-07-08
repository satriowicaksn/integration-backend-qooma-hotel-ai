import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { DepartmentTelegramWriteStubAdapter } from '../adapters/department-telegram-write-stub.adapter.js';

const DEPT_ID = 'dept-hk-01';
const CHAT_ID = '-1001234567890';
const SUPERVISOR_ID = '987654321';

interface LoggerMock extends Logger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}

function buildLogger(): LoggerMock {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('DepartmentTelegramWriteStubAdapter.updateRouting', () => {
  it('should return { updated: true } unconditionally (write stub never persists to HC)', async () => {
    const adapter = new DepartmentTelegramWriteStubAdapter(buildLogger());
    const result = await adapter.updateRouting({
      deptId: DEPT_ID,
      telegramChatId: CHAT_ID,
      supervisorTelegramId: SUPERVISOR_ID,
    });
    expect(result).toEqual({ updated: true });
  });

  it('should emit a hc_write_stubbed warn with last-4 PII suffixes and NEVER the full routing IDs', async () => {
    const logger = buildLogger();
    const adapter = new DepartmentTelegramWriteStubAdapter(logger);
    await adapter.updateRouting({
      deptId: DEPT_ID,
      telegramChatId: CHAT_ID,
      supervisorTelegramId: SUPERVISOR_ID,
    });
    const record = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record['msg']).toBe('telegram_dept_routing.hc_write_stubbed');
    expect(record['port']).toBe('department_telegram_write');
    expect(record['deptId']).toBe(DEPT_ID);
    expect(record['telegramChatIdSuffix']).toBe('7890');
    expect(record['supervisorTelegramIdSuffix']).toBe('4321');
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain(CHAT_ID);
    expect(serialized).not.toContain(SUPERVISOR_ID);
  });

  it('should omit supervisor suffix when only telegramChatId is provided (partial-update log-reflection, binding #12)', async () => {
    const logger = buildLogger();
    const adapter = new DepartmentTelegramWriteStubAdapter(logger);
    await adapter.updateRouting({ deptId: DEPT_ID, telegramChatId: CHAT_ID });
    const record = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record).toHaveProperty('telegramChatIdSuffix');
    expect(record).not.toHaveProperty('supervisorTelegramIdSuffix');
  });

  it('should omit chat suffix when only supervisorTelegramId is provided (binding #12 mirror)', async () => {
    const logger = buildLogger();
    const adapter = new DepartmentTelegramWriteStubAdapter(logger);
    await adapter.updateRouting({ deptId: DEPT_ID, supervisorTelegramId: SUPERVISOR_ID });
    const record = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record).toHaveProperty('supervisorTelegramIdSuffix');
    expect(record).not.toHaveProperty('telegramChatIdSuffix');
  });

  it('should omit both suffixes when neither routing ID is provided (edge branch coverage)', async () => {
    const logger = buildLogger();
    const adapter = new DepartmentTelegramWriteStubAdapter(logger);
    await adapter.updateRouting({ deptId: DEPT_ID });
    const record = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record).not.toHaveProperty('telegramChatIdSuffix');
    expect(record).not.toHaveProperty('supervisorTelegramIdSuffix');
  });
});
