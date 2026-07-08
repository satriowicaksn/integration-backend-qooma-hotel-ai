// Domain types for T18 per-dept Telegram routing write-through primitive
// (spec 04-integration-channels.md §2.1 row 30 + §3.2 + MVP §1.3 C2 + §4.10).
// Wire types live in telegram-dept-routing.schema.ts (zod, source of truth).

/** Input consumed by `TelegramDeptRoutingService.updateRouting`.
 *  `hotelId` is the session-scoped tenant (extracted from JWT at the
 *  handler layer post-Q-C-03). `deptId` targets HC's `departments` row.
 *  Both routing IDs are optional individually but at least one MUST be
 *  present (enforced at schema boundary). */
export interface UpdateDepartmentTelegramRoutingInput {
  readonly hotelId: string;
  readonly deptId: string;
  readonly telegramChatId?: string;
  readonly supervisorTelegramId?: string;
}

/** Result returned after a successful write-through.
 *  `updatedAt` is clock-injected so tests can assert deterministically. */
export interface TelegramDeptRoutingResult {
  readonly updated: true;
  readonly updatedAt: Date;
}

/** Narrow view returned by `DepartmentTelegramReadPort.getForTenantCheck`
 *  — only the `hotelId` needed to verify tenancy before write.
 *  Reader-port pattern per T23 §1262 first-class slot-C architecture. */
export interface DepartmentTenancy {
  readonly hotelId: string;
}
