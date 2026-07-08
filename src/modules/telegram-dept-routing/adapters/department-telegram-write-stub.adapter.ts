// MVP stub adapter for `DepartmentTelegramWritePort` (T18-followup PLAN GAP #1/#3).
// Q-OPS-06 (shared-DB vs RPC) + Q-CONTRACT-25 (HC write contract) are
// unresolved at Parent PM — this stub returns `{ updated: true }`
// unconditionally + logs `hc_write_stubbed` per invocation. HC's
// `departments` table is NEVER written. The T18 primitive service's
// upstream tenancy check gates access; if we reach the writer, tenancy
// has already passed.
//
// PII discipline: telegram routing IDs are last-4 suffix only in logs;
// full IDs NEVER appear in the log record.
//
// Swap this file for the real HTTP / Prisma adapter once Q-OPS-06 +
// Q-CONTRACT-25 land.

import type { Logger } from '@core/logger/logger.js';

import type {
  DepartmentTelegramWritePort,
  DepartmentTelegramWriteResult,
} from '../ports/department-telegram-write.port.js';

const SUFFIX_LEN = 4;
const UPDATED: DepartmentTelegramWriteResult = { updated: true };

export class DepartmentTelegramWriteStubAdapter implements DepartmentTelegramWritePort {
  constructor(private readonly logger: Logger) {}

  async updateRouting(input: {
    deptId: string;
    telegramChatId?: string;
    supervisorTelegramId?: string;
  }): Promise<DepartmentTelegramWriteResult> {
    this.logger.warn({
      msg: 'telegram_dept_routing.hc_write_stubbed',
      module: 'telegram-dept-routing',
      port: 'department_telegram_write',
      deptId: input.deptId,
      ...(input.telegramChatId !== undefined
        ? { telegramChatIdSuffix: input.telegramChatId.slice(-SUFFIX_LEN) }
        : {}),
      ...(input.supervisorTelegramId !== undefined
        ? { supervisorTelegramIdSuffix: input.supervisorTelegramId.slice(-SUFFIX_LEN) }
        : {}),
    });
    return Promise.resolve(UPDATED);
  }
}
