// Per-dept Telegram routing write-through orchestrator (spec §2.1 row 30
// + §3.2 + §4.10 tenancy guard).
//
// Flow: verify dept belongs to session's hotel → write routing IDs via
// port → log with PII suffixes (never full IDs) → return.
//
// **Discipline highlights**:
// - §4.10 enumeration guard: cross-tenant → SAME `NotFoundError` shape as
//   dept-missing. Callers (and attackers) CANNOT distinguish the two.
// - Race condition (dept deleted between check and write): writer returns
//   `{ notFound: true }` → mapped to same `NotFoundError`.
// - PII: `telegram_chat_id` can be an individual user id (per T20
//   binding #4); `supervisor_telegram_id` is always an individual user id.
//   Both are logged as last-4 suffix only.
// - Clock injectable (T20/T22/T24 precedent) for deterministic tests.

import { NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { DepartmentTelegramReadPort } from './ports/department-telegram-read.port.js';
import type { DepartmentTelegramWritePort } from './ports/department-telegram-write.port.js';
import type {
  TelegramDeptRoutingResult,
  UpdateDepartmentTelegramRoutingInput,
} from './telegram-dept-routing.types.js';

export interface TelegramDeptRoutingPorts {
  readonly deptRead: DepartmentTelegramReadPort;
  readonly deptWrite: DepartmentTelegramWritePort;
}

export interface RoutingClock {
  now(): Date;
}

const SYSTEM_CLOCK: RoutingClock = { now: () => new Date() };

const ID_SUFFIX_LENGTH = 4;

export class TelegramDeptRoutingService {
  private readonly clock: RoutingClock;

  constructor(
    private readonly ports: TelegramDeptRoutingPorts,
    private readonly logger: Logger,
    clock?: RoutingClock,
  ) {
    this.clock = clock ?? SYSTEM_CLOCK;
  }

  async updateRouting(
    input: UpdateDepartmentTelegramRoutingInput,
  ): Promise<TelegramDeptRoutingResult> {
    const tenancy = await this.ports.deptRead.getForTenantCheck({ deptId: input.deptId });
    if (tenancy === null || tenancy.hotelId !== input.hotelId) {
      throw new NotFoundError('department', input.deptId);
    }

    const writeResult = await this.ports.deptWrite.updateRouting({
      deptId: input.deptId,
      ...(input.telegramChatId !== undefined ? { telegramChatId: input.telegramChatId } : {}),
      ...(input.supervisorTelegramId !== undefined
        ? { supervisorTelegramId: input.supervisorTelegramId }
        : {}),
    });

    if ('notFound' in writeResult) {
      throw new NotFoundError('department', input.deptId);
    }

    const updatedAt = this.clock.now();

    this.logger.info({
      msg: 'telegram_dept_routing.updated',
      module: 'telegram-dept-routing',
      hotelId: input.hotelId,
      deptId: input.deptId,
      ...(input.telegramChatId !== undefined
        ? { telegramChatIdSuffix: input.telegramChatId.slice(-ID_SUFFIX_LENGTH) }
        : {}),
      ...(input.supervisorTelegramId !== undefined
        ? { supervisorTelegramIdSuffix: input.supervisorTelegramId.slice(-ID_SUFFIX_LENGTH) }
        : {}),
    });

    return { updated: true, updatedAt };
  }
}
