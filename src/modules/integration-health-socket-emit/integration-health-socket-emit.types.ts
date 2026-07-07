// Domain types for T25 socket emit primitive (spec §5 row 321 + §7).
//
// **Local type mirror discipline** (PM C ACK T25 binding #1): the
// camelCase input shape below intentionally mirrors T24's
// `HealthChangedEvent` shape verbatim, but this module does NOT import
// from `@modules/channel-health` at runtime OR type layer. If T24's
// shape ever changes, the mismatch surfaces at the T25-followup
// composition-layer boundary (test/typecheck catches it) — the primitive
// stays fully independent for Docker-green isolation.

export type HealthProvider = 'whatsapp' | 'telegram' | 'claude_api';
export type HealthStatus = 'healthy' | 'degraded' | 'down';

/** camelCase input shape consumed by `HealthChangedPublisherService.publishAll`.
 *  Matches T24's `HealthChangedEvent` verbatim so the (future) worker
 *  composition can pipe `runProbesForHotel(...)` output directly here. */
export interface HealthChangedEventPayload {
  readonly hotelId: string;
  readonly provider: HealthProvider;
  readonly previousStatus: HealthStatus | null;
  readonly newStatus: HealthStatus;
  readonly checkedAt: Date;
}

/** snake_case WIRE shape sent through `SocketPublisherPort.publish`.
 *  This is what gateway / FE consumers observe. Derived from the input
 *  above via the case-conversion helper inside the service (PM C ACK T25
 *  binding #2). */
export interface HealthChangedEventWirePayload {
  readonly hotel_id: string;
  readonly provider: HealthProvider;
  readonly previous_status: HealthStatus | null;
  readonly new_status: HealthStatus;
  readonly checked_at: string;
}

/** Return value of `publishAll` — surfaced for cron-side observability
 *  (T25-followup uses `failures` to gate alerts). */
export interface PublishSummary {
  readonly published: number;
  readonly failures: number;
  readonly errorCodes: readonly string[];
}
