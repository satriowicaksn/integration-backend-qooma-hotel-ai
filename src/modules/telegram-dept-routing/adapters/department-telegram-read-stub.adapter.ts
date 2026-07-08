// MVP stub adapter for `DepartmentTelegramReadPort` (T18-followup PLAN GAP #1).
// Q-OPS-06 + Q-CONTRACT-25 are unresolved at Parent PM — this stub reads
// tenancy from an env-based `TELEGRAM_DEPT_ROUTING_MAP` JSON blob so the
// composition can be integration-tested end-to-end. A future adapter swap
// (shared-DB Prisma query OR RPC to HC) lands the real read once those
// two Qs ratify.
//
// Swap this file for the real adapter once Q-OPS-06 + Q-CONTRACT-25 land.

import type { DepartmentTelegramReadPort } from '../ports/department-telegram-read.port.js';
import type { DepartmentTenancy } from '../telegram-dept-routing.types.js';

export class DepartmentTelegramReadStubAdapter implements DepartmentTelegramReadPort {
  private readonly map: ReadonlyMap<string, string>;

  constructor(mapJson: string) {
    this.map = parseMap(mapJson);
  }

  async getForTenantCheck(input: { deptId: string }): Promise<DepartmentTenancy | null> {
    const hotelId = this.map.get(input.deptId);
    return Promise.resolve(hotelId === undefined ? null : { hotelId });
  }
}

function parseMap(json: string): ReadonlyMap<string, string> {
  if (json.trim() === '') return new Map();
  const parsed = JSON.parse(json) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('TELEGRAM_DEPT_ROUTING_MAP must be a JSON object of { deptId: hotelId }');
  }
  const entries: [string, string][] = [];
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== 'string' || v === '') {
      throw new TypeError(
        `TELEGRAM_DEPT_ROUTING_MAP value for dept "${k}" must be a non-empty string`,
      );
    }
    entries.push([k, v]);
  }
  return new Map(entries);
}
