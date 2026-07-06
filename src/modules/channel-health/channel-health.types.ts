// Domain types for T24 channel-health probes (spec §7 + §4.7 + §4.8).
// Wire types (HealthResponse for GET /api/integrations/health) live in
// channel-health.schema.ts (zod, source of truth).

export type HealthProvider = 'whatsapp' | 'telegram' | 'claude_api';
export type HealthStatus = 'healthy' | 'degraded' | 'down';

/** Result returned by a per-provider probe (external IO port). */
export type ProbeResult =
  | { readonly ok: true; readonly latencyMs: number }
  | { readonly ok: false; readonly error: string };

/** Persisted snapshot of a probe (one row per poll per provider per hotel). */
export interface ChannelHealthDomain {
  readonly id: string;
  readonly hotelId: string;
  readonly provider: HealthProvider;
  readonly status: HealthStatus;
  readonly latencyMs: number | null;
  readonly checkedAt: Date;
}

/**
 * Result of applying the 2-poll debounce state machine (spec §4.8).
 * `nextStatus` = the status to persist for THIS poll cycle.
 * `didTransition` = true when nextStatus differs from previous — caller
 * (T25 socket emitter) uses this to gate `integration:health_changed`.
 */
export interface DebouncedTransition {
  readonly nextStatus: HealthStatus;
  readonly didTransition: boolean;
  readonly previousStatus: HealthStatus | null;
}

/**
 * Event returned by the service on state transitions. T24 primitive returns
 * an array of these per poll cycle; T25 (C9) publishes them via socket
 * (`integration:health_changed`). Shape confirmed by PM C ACK §562 default —
 * T25 may adjust when landed.
 */
export interface HealthChangedEvent {
  readonly hotelId: string;
  readonly provider: HealthProvider;
  readonly previousStatus: HealthStatus | null;
  readonly newStatus: HealthStatus;
  readonly checkedAt: Date;
}
