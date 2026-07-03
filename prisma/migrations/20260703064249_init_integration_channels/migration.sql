-- CreateTable
CREATE TABLE "wa_configs" (
    "hotel_id" UUID NOT NULL,
    "bsp" VARCHAR(40) NOT NULL DEFAULT '1engage',
    "phone_number_id" VARCHAR(80) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "access_token_enc" TEXT NOT NULL,
    "webhook_url" VARCHAR(500) NOT NULL,
    "webhook_verify_token" VARCHAR(80) NOT NULL,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wa_configs_pkey" PRIMARY KEY ("hotel_id")
);

-- CreateTable
CREATE TABLE "telegram_configs" (
    "hotel_id" UUID NOT NULL,
    "bot_token_enc" TEXT NOT NULL,
    "bot_username" VARCHAR(40) NOT NULL,
    "default_chat_id" VARCHAR(64),
    "gm_telegram_id" VARCHAR(64),
    "webhook_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "telegram_configs_pkey" PRIMARY KEY ("hotel_id")
);

-- CreateTable
CREATE TABLE "qr_state" (
    "hotel_id" UUID NOT NULL,
    "wa_link" VARCHAR(500) NOT NULL,
    "png_url" VARCHAR(500) NOT NULL,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_state_pkey" PRIMARY KEY ("hotel_id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature_valid" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ,
    "process_error" JSONB,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_dispatch_queue" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "guest_id" UUID,
    "template_name" VARCHAR(80),
    "body" TEXT,
    "variables" JSONB,
    "scheduled_for" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ,
    "external_id" VARCHAR(80),
    "last_error" JSONB,

    CONSTRAINT "outbound_dispatch_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_receipts" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "dispatch_id" UUID NOT NULL,
    "external_id" VARCHAR(80) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_health_snapshots" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "latency_ms" INTEGER,
    "checked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ota_mailbox_state" (
    "hotel_id" UUID NOT NULL,
    "imap_host" VARCHAR(255) NOT NULL,
    "imap_username" VARCHAR(255) NOT NULL,
    "imap_password_enc" TEXT NOT NULL,
    "last_poll_at" TIMESTAMPTZ,
    "last_uid_seen" INTEGER,
    "poll_error" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ota_mailbox_state_pkey" PRIMARY KEY ("hotel_id")
);

-- CreateIndex
CREATE INDEX "wa_configs_hotel_id_idx" ON "wa_configs"("hotel_id");

-- CreateIndex
CREATE INDEX "telegram_configs_hotel_id_idx" ON "telegram_configs"("hotel_id");

-- CreateIndex
CREATE INDEX "webhook_events_hotel_id_received_at_idx" ON "webhook_events"("hotel_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "outbound_dispatch_queue_hotel_id_scheduled_for_idx" ON "outbound_dispatch_queue"("hotel_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "outbound_dispatch_queue_external_id_idx" ON "outbound_dispatch_queue"("external_id");

-- CreateIndex
CREATE INDEX "delivery_receipts_hotel_id_idx" ON "delivery_receipts"("hotel_id");

-- CreateIndex
CREATE INDEX "delivery_receipts_dispatch_id_idx" ON "delivery_receipts"("dispatch_id");

-- CreateIndex
CREATE INDEX "channel_health_snapshots_hotel_id_provider_checked_at_idx" ON "channel_health_snapshots"("hotel_id", "provider", "checked_at" DESC);

-- AddForeignKey
ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "outbound_dispatch_queue"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Post-schema raw SQL (not expressible in Prisma PSL)
-- Source: prisma/schema.prisma post-migration block + 04-integration-channels.md §4
-- ---------------------------------------------------------------------------

-- CHECK constraints (enum-like column guards)
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_provider_check"
  CHECK (provider IN ('whatsapp','telegram'));
ALTER TABLE "outbound_dispatch_queue" ADD CONSTRAINT "outbound_status_check"
  CHECK (status IN ('pending','sent','failed','dead'));
ALTER TABLE "outbound_dispatch_queue" ADD CONSTRAINT "outbound_provider_check"
  CHECK (provider IN ('whatsapp','telegram'));
ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_status_check"
  CHECK (status IN ('sent','delivered','read','failed'));
ALTER TABLE "channel_health_snapshots" ADD CONSTRAINT "channel_health_status_check"
  CHECK (status IN ('healthy','degraded','down'));
ALTER TABLE "channel_health_snapshots" ADD CONSTRAINT "channel_health_provider_check"
  CHECK (provider IN ('whatsapp','telegram','claude_api'));

-- Partial indexes (hot-path queue scans)
CREATE INDEX "idx_webhook_events_unprocessed" ON "webhook_events"("hotel_id", "received_at")
  WHERE processed_at IS NULL;
CREATE INDEX "idx_outbound_pending" ON "outbound_dispatch_queue"("scheduled_for")
  WHERE status = 'pending';
