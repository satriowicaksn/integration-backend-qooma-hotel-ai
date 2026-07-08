// Writer port for `departments.telegram_chat_id` /
// `.supervisor_telegram_id` (HC-owned columns).
// TYPE-ONLY. Adapter (T18-followup) forks on Q-OPS-06 (shared-DB direct
// write vs RPC to Hotel Core). Primitive is decision-agnostic.
//
// Return-type is a discriminated union — NOT a throw — so the service can
// distinguish a race-condition dept-delete-between-check-and-write
// (`notFound`) from a successful update. Adapter surfaces its own
// exception classes only for infrastructure faults (DB down, RPC 5xx).

export type DepartmentTelegramWriteResult = { updated: true } | { notFound: true };

/** Partial-update semantic (PM C ACK T18 binding #12): the adapter MUST
 *  update only the fields present in `input`. An absent `telegramChatId`
 *  preserves the existing value in HC's `departments` row; likewise for
 *  `supervisorTelegramId`. Adapter MUST NOT null-out unspecified fields. */
export interface DepartmentTelegramWritePort {
  updateRouting(input: {
    deptId: string;
    telegramChatId?: string;
    supervisorTelegramId?: string;
  }): Promise<DepartmentTelegramWriteResult>;
}
