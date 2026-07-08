// Reader port for tenancy verification of HC's `departments` row.
// TYPE-ONLY. Adapter (T18-followup) resolves via one of:
//   (a) shared-DB direct Prisma query against `departments` (if Q-OPS-06
//       lands shared-DB), OR
//   (b) RPC to Hotel Core `GET /internal/departments/:id` (if RPC).
// Primitive is decision-agnostic; port abstraction absorbs the choice.
//
// Reader-port pattern per T23 §1262 + T20 binding #1.

import type { DepartmentTenancy } from '../telegram-dept-routing.types.js';

export interface DepartmentTelegramReadPort {
  getForTenantCheck(input: { deptId: string }): Promise<DepartmentTenancy | null>;
}
