/**
 * Domain types for the T12 WhatsApp inbound webhook ingest primitive (spec
 * §3.1 3-leg flow + §4.4 `webhook_events` DDL + §4.7 persist-fast pattern).
 *
 * Two legs per spec `MVP §4.7`:
 *  - **sync leg** (`ingestSync`): router-called, persists raw payload to
 *    `webhook_events` with `signatureValid` flag, returns eventId within the
 *    10s Meta-timeout budget.
 *  - **async leg** (`processEvent`): worker-called, extracts normalized
 *    messages from the trusted payload, resolves guest via HC RPC, dispatches
 *    to AI RPC. Never throws — failure paths return rich `IngestOutcome[]`
 *    (worker discipline mirrors T11 probe-semantics).
 *
 * **Assumption stamps** (refactor sites when Qs resolve):
 *  - **Q-B-04 assumption A**: HC exposes `upsert_guest_by_wa_phone(hotelId,
 *    waPhone, name?) → { guestId }` as a single-shot RPC. Port `HotelCoreGuestUpsertPort`
 *    is TYPE-ONLY in primitive; adapter lands at T12-followup after HC/PO
 *    ratifies URL / path / error catalog.
 *  - **Q-B-05 assumption A**: AI exposes `inbound_wa_message(hotelId, guestId,
 *    body, messageId)` fire-and-forget (spec §3.2 L311 opaque, no return). Port
 *    `AiInboundMessagePort` is TYPE-ONLY; adapter defers to T12-followup.
 *  - **Q-B-06 D deferred**: `webhook_events` schema has no `external_id` /
 *    `dedup_key` column (spec drift from §4.6). Primitive persists blindly;
 *    `WhatsappInboundIngestResponse.isDuplicate` is a placeholder that always
 *    returns `false` in this primitive so the router wire contract survives
 *    schema-add. T12-followup fills the semantics after Q-B-06 lands.
 */

export type WebhookEventProvider = 'whatsapp' | 'telegram';

/**
 * Write shape for `WhatsappWebhookEventsRepository.persist`. `payload` is the
 * raw Meta envelope stored as `Prisma.JsonValue`; caller (service) is
 * responsible for zod-parsing before persist.
 */
export interface WebhookEventPersistenceInput {
  readonly hotelId: string;
  readonly provider: WebhookEventProvider;
  readonly signatureValid: boolean;
  readonly payload: unknown;
}

/**
 * Normalized message extracted from the Meta envelope by
 * `extractInboundMessages`. Q-B-05 assumption A stamp: `waPhone` is the
 * inbound `from` field (E.164 without `+`), `body` is `text.body` (empty
 * string if the message type is non-text).
 */
export interface WhatsappInboundMessage {
  readonly messageId: string;
  readonly waPhone: string;
  readonly body: string;
  readonly timestamp: string;
  readonly profileName?: string | undefined;
}

/** Per-message outcome recorded by the async worker leg. Never thrown. */
export interface IngestOutcome {
  readonly messageId: string;
  readonly guestId?: string | undefined;
  readonly dispatched: boolean;
  readonly aiReply?: string | undefined;
  readonly error?: string | undefined;
}

/**
 * Q-B-04 assumption A stamp — HC guest upsert port I/O. Refactor targets when
 * PO/HC ratifies: this shape moves into `hotelCoreGuestUpsert.contract.ts` if
 * we go with a broader HC contract file.
 */
export interface GuestUpsertInput {
  readonly hotelId: string;
  readonly waPhone: string;
  readonly name?: string | undefined;
}

export interface GuestUpsertResult {
  readonly guestId: string;
}

/** Single message turn sent to AI service POST /internal/ai/chat `messages[]`. */
export interface AiChatMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

/**
 * Input for `AiInboundMessagePort.inboundWaMessage`, maps 1:1 to
 * AI service POST /internal/ai/chat request body (snake_case conversion
 * done in the HTTP adapter).
 */
export interface AiInboundInput {
  readonly hotelId: string;
  readonly agentSlug: string;
  readonly sourceId: string;
  readonly messages: AiChatMessage[];
  readonly context: {
    readonly guestId: string | null;
    readonly channel: 'whatsapp' | 'telegram' | 'internal';
    readonly locale: 'id' | 'en';
  };
}

/** Subset of AI service POST /internal/ai/chat response 200 used by the adapter. */
export interface AiChatResult {
  readonly conversationId: string;
  readonly reply: string;
  readonly stopReason: string;
}
