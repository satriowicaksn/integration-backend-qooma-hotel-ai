/**
 * Domain types for the WA verify-webhook action (spec §2.2 + §5 AC L119 + §9
 * L373). T11 is an outbound reachability probe — us → hotel's configured
 * `wa_configs.webhook_url` — distinct from T04 inbound HMAC verify.
 *
 * The service returns a rich `WebhookVerificationDomain` so the future
 * T11-followup router can (a) map the successful branch to `200 { verified,
 * verifiedAt }` per spec AC, (b) map every non-verified outcome to
 * `422 WEBHOOK_VERIFICATION_FAILED` while still emitting the `outcome` +
 * `statusCode` for observability + FE diagnostics.
 */

export type WebhookVerificationOutcome = 'verified' | 'unreachable' | 'invalid_response';

export interface WebhookVerificationDomain {
  readonly hotelId: string;
  readonly verified: boolean;
  readonly verifiedAt: Date | null;
  readonly outcome: WebhookVerificationOutcome;
  readonly statusCode?: number | undefined;
  readonly reason?: string | undefined;
}

export interface WebhookPingerInput {
  readonly url: string;
}

export interface WebhookPingerResult {
  readonly reachable: boolean;
  readonly statusCode?: number | undefined;
}
