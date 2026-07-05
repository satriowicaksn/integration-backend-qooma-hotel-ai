/**
 * HTTP adapter for the outbound webhook-reachability probe — implements
 * `WebhookPingerPort` via a narrow `HttpPoster` interface re-declared inline
 * (T06 + T16 precedent). No coupling to the stubbed `core/http/http-client.ts`;
 * the entrypoint wiring (T11-followup, blocked on Q-C-02) injects the concrete
 * HTTP client.
 *
 * **Probe semantics — this adapter does NOT throw** (PM B ACK binding
 * condition #14):
 *
 * Unlike T06 / T16 adapters, this adapter does NOT throw `ExternalServiceError`
 * on non-2xx or network errors. T11 is a REACHABILITY PROBE — non-2xx and
 * network errors are LEGITIMATE outcomes of asking "is this URL reachable?"
 * Throwing `ExternalServiceError` on every 404-from-hotel-misconfig would
 * flood Sentry with non-actionable alerts. The result object
 * `{ reachable, statusCode? }` is returned in all outcomes; the boundary
 * `WebhookVerificationError` (422) is emitted at the SERVICE / route layer,
 * not here.
 *
 * **HttpPoster naming** — kept for T06 / T16 consistency even though only the
 * `get` method is used at this adapter. Re-declared narrowly with `get<T>`
 * only (no `post` / `patch` / `delete` needed at the pinger surface).
 *
 * **No auth header** — the hotel's `webhook_url` is a public HTTP endpoint by
 * design (Meta itself has no shared secret when hitting it); the request goes
 * out without `Authorization`, no bearer token, no header injection.
 */

import type { WebhookPingerPort } from '../ports/webhook-pinger.port.js';
import type { WebhookPingerInput, WebhookPingerResult } from '../whatsapp-webhook-verify.types.js';

export interface HttpPoster {
  get<T>(url: string, opts?: unknown): Promise<{ data: T; status: number }>;
}

export interface HttpWebhookPingerConfig {
  timeoutMs?: number;
}

export interface HttpWebhookPingerAdapterDeps {
  http: HttpPoster;
  config?: HttpWebhookPingerConfig;
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

export function createHttpWebhookPingerAdapter(
  deps: HttpWebhookPingerAdapterDeps,
): WebhookPingerPort {
  const { http, config } = deps;

  const requestOptions =
    config?.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : undefined;

  async function ping(input: WebhookPingerInput): Promise<WebhookPingerResult> {
    let res: { data: unknown; status: number };
    try {
      res = await http.get<unknown>(input.url, requestOptions);
    } catch {
      return { reachable: false };
    }
    if (isSuccessStatus(res.status)) {
      return { reachable: true, statusCode: res.status };
    }
    return { reachable: false, statusCode: res.status };
  }

  return { ping };
}
