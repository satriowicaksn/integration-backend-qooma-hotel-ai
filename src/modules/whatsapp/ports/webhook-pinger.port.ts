/**
 * Outbound webhook-reachability probe port. The adapter is a network-side
 * dependency that MUST be swappable at test time (jest mock) or at wiring
 * time (real HTTP vs mock server in integration tests) — hexagonal-disiplin
 * WAJIB port + adapter per CLAUDE §4 for outbound HTTP.
 *
 * **Probe semantics** (PM B ACK design decision + binding condition #14):
 * the port contract intentionally returns a rich result object for ALL
 * outcomes (reachable success, non-2xx response, network error) — no
 * exceptions are thrown at this layer. Boundary `WebhookVerificationError`
 * (422) is emitted at the service / route layer where the outcome is mapped
 * to an HTTP response. See `adapters/http-webhook-pinger.adapter.ts`
 * docstring for the Sentry-flood rationale.
 */

import type { WebhookPingerInput, WebhookPingerResult } from '../whatsapp-webhook-verify.types.js';

export interface WebhookPingerPort {
  ping(input: WebhookPingerInput): Promise<WebhookPingerResult>;
}
