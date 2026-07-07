// Pure state machine for the 2-poll debounce rule (spec §4.8 + §7):
// - `healthy` on any successful probe (immediate recovery).
// - 1st consecutive failure → `degraded` (soft signal, FE badge yellow).
// - 2nd consecutive failure → `down` (hard signal, alerts).
//
// PM C ACK T24 §559 ratified this default for GAP-#2 (SRE yellow→red
// progression). Q-C-08 (open) tracks the PO ratification for whether
// `degraded` should instead map to high-latency-with-ok-probe; that's a
// non-breaking refactor of this file if the semantics flip.

import type { DebouncedTransition, HealthStatus, ProbeResult } from './channel-health.types.js';

/**
 * Applies the debounce rule.
 *
 * @param previousStatus  The last persisted status for the same hotel+provider,
 *                        or `null` when this is the first-ever probe.
 * @param probe           The current probe result.
 */
export function applyDebounce(
  previousStatus: HealthStatus | null,
  probe: ProbeResult,
): DebouncedTransition {
  const nextStatus = deriveNextStatus(previousStatus, probe);
  return {
    nextStatus,
    previousStatus,
    didTransition: previousStatus !== nextStatus,
  };
}

function deriveNextStatus(previous: HealthStatus | null, probe: ProbeResult): HealthStatus {
  if (probe.ok) {
    return 'healthy';
  }
  switch (previous) {
    case null:
    case 'healthy':
      return 'degraded';
    case 'degraded':
    case 'down':
      return 'down';
  }
}
