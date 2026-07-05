/**
 * Domain types for the T13 WhatsApp outbound dispatch primitive (spec §2.4
 * `send_wa_message(hotel_id, guest_id, body, template?, variables?)` + §3.1
 * 6-step flow).
 *
 * **Auth-agnostic**: the T09 internal-RPC-auth plugin (`X-Internal-Secret`
 * header) guards the INBOUND RPC route at router-layer preHandler
 * (T13-followup wiring); this primitive consumes an already-authorized RPC
 * payload. Extends T12 signature-agnostic + T15 receiver-only precedents to
 * the RPC receiver context.
 *
 * **Discriminated union outcome** (T15 pattern extended — pre-empts T12
 * `as string` recurrence). Consumers narrow on `kind`; TypeScript proves
 * per-variant field access without any type assertion.
 *
 * **Q-B-08 assumption stamp** (HC quota RPC contract) — port
 * `HotelCoreQuotaPort` is TYPE-ONLY in this primitive; adapter lands at
 * T13-followup once Q-B-08 ratifies URL / path / payload / response / error
 * catalog + Q-C-02 wires `HC_BASE_URL` + `INTERNAL_SECRET`.
 *
 * **Q-B-09 assumption stamp** (HC DND RPC contract) — port
 * `HotelCoreDndPort` is TYPE-ONLY in this primitive; adapter lands at
 * T13-followup. HC or Auth hosts DND is HC-team's call per Q-B-09.
 */

export type OutboundDispatchProvider = 'whatsapp';

export type OutboundDispatchStatus = 'pending' | 'sent' | 'failed' | 'dead';

/**
 * Template shape when the caller wants a template dispatch. Mirrors T06 BSP
 * `SendTemplateInput` field names but scoped to the RPC-level (no `credentials`
 * or `to` — those get filled in service from wa_configs + request).
 */
export interface OutboundDispatchTemplate {
  readonly name: string;
  readonly languageCode: string;
  readonly variables?: ReadonlyArray<string> | undefined;
}

/**
 * RPC request payload as accepted by the service. Wire schema enforces that
 * exactly ONE of `body` (text) or `template` is present.
 */
export interface OutboundDispatchRequest {
  readonly hotelId: string;
  readonly guestId: string;
  readonly recipientPhone: string;
  readonly body?: string | undefined;
  readonly template?: OutboundDispatchTemplate | undefined;
}

/**
 * Repository read shape — plaintext credentials returned by
 * `findConfigForDispatch`. Cross-table sibling read on `wa_configs`;
 * `accessTokenPlaintext` is `decrypt(row.accessTokenEnc)` performed
 * INTERNALLY by the repo (T15 precedent). Never logged; T13 service handles
 * it in-memory then discards.
 */
export interface OutboundDispatchConfig {
  readonly bsp: string;
  readonly phoneNumberId: string;
  readonly accessTokenPlaintext: string;
}

/**
 * Repository write shape for `persistPending` — creates
 * `outbound_dispatch_queue` row with `status='pending'`. External id + sent_at
 * are populated later via `markSent`.
 */
export interface OutboundDispatchPersistenceInput {
  readonly hotelId: string;
  readonly guestId: string;
  readonly provider: OutboundDispatchProvider;
  readonly body?: string | undefined;
  readonly templateName?: string | undefined;
  readonly variables?: ReadonlyArray<string> | undefined;
}

/**
 * Quota RPC 2-phase Phase-1 result (Q-B-08 assumption stamp).
 * `reservationId` is opaque to T13; passed back verbatim to `commit` /
 * `rollback` in Phase 2.
 */
export type QuotaCheckResult =
  | { readonly reserved: true; readonly reservationId: string }
  | { readonly reserved: false; readonly reason: string };

/**
 * DND RPC result (Q-B-09 assumption stamp). Service bypasses DND rejection
 * when `blocked: true` AND `vvipExempt: true` — spec §4.4 VVIP-exempt bypass.
 * Inbound-trigger flag is caller responsibility (HC/AI decide when sending).
 */
export interface DndCheckResult {
  readonly blocked: boolean;
  readonly vvipExempt: boolean;
}

/**
 * Discriminated union outcome — TypeScript proves per-variant field access
 * without any `as X` cast. Mirrors T15 pattern; pre-empts T12 as-string
 * recurrence.
 *  - `dispatched` — happy path (both persist + mark + commit succeeded)
 *  - `rejected_dnd` — DND check blocked (no persist, no reservation)
 *  - `quota_exhausted` — Phase-1 refused (no persist)
 *  - `meta_failed` — persisted then Meta call failed (markFailed + rollback)
 */
export type OutboundDispatchOutcome =
  | { readonly kind: 'dispatched'; readonly dispatchId: string; readonly externalId: string }
  | { readonly kind: 'rejected_dnd'; readonly reason: string }
  | { readonly kind: 'quota_exhausted'; readonly reason: string }
  | {
      readonly kind: 'meta_failed';
      readonly dispatchId: string;
      readonly status?: number | undefined;
      readonly body?: unknown;
    };
