-- T29 (ADR-0010): WA conversation + message tables.
-- Corrections applied per PM C consolidated ACK (2026-07-09):
--   guestWaPhone VARCHAR(20); lastMessagePreview truncated at service (200);
--   external_message_id partial INDEX (NOT unique) — dedup at webhook_events.

BEGIN;

-- =============================================================================
-- conversations
-- =============================================================================
CREATE TABLE "conversations" (
    "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id"             UUID         NOT NULL,
    "wa_config_id"         UUID         NOT NULL,
    "guest_wa_phone"       VARCHAR(20)  NOT NULL,
    "guest_id"             UUID,
    "last_message_at"      TIMESTAMPTZ  NOT NULL,
    "last_message_preview" TEXT,
    "unread_count"         INTEGER      NOT NULL DEFAULT 0,
    "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversations_hotel_id_guest_wa_phone_key"
    ON "conversations" ("hotel_id", "guest_wa_phone");
CREATE INDEX "conversations_hotel_id_last_message_at_idx"
    ON "conversations" ("hotel_id", "last_message_at" DESC);

-- =============================================================================
-- messages
-- =============================================================================
CREATE TABLE "messages" (
    "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id"      UUID         NOT NULL,
    "direction"            VARCHAR(10)  NOT NULL,
    "body"                 TEXT,
    "template_ref"         VARCHAR(120),
    "template_variables"   JSONB,
    "external_message_id"  VARCHAR(120),
    "status"               VARCHAR(20)  NOT NULL,
    "received_at"          TIMESTAMPTZ,
    "sent_at"              TIMESTAMPTZ,
    "dispatch_id"          UUID,
    "webhook_event_id"     UUID,
    "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_conversation_id_fkey"
        FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "messages_conversation_id_created_at_idx"
    ON "messages" ("conversation_id", "created_at" DESC);

-- Partial INDEX (NOT unique) per ADR-0010 line 79 + PM C ACK correction.
-- Dedup is at `webhook_events(provider, external_id)` per Q-B-06 boundary.
CREATE INDEX "messages_external_message_id_idx"
    ON "messages" ("external_message_id")
    WHERE "external_message_id" IS NOT NULL;

-- ADR-0010 line 66: direction enum('inbound','outbound')
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_direction_check"
    CHECK ("direction" IN ('inbound', 'outbound'));

COMMIT;
