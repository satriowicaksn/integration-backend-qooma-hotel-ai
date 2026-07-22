-- T97 (ADD-24) — OTP delivery-verification ticket context.
-- Hand-written (no `prisma migrate dev` against a live DB per task rules).

-- CreateTable
CREATE TABLE "otp_ticket_context" (
    "ticket_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "chat_id" VARCHAR(64) NOT NULL,
    "telegram_message_id" INTEGER NOT NULL,
    "guest_wa_phone" VARCHAR(20),
    "guest_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "otp_ticket_context_pkey" PRIMARY KEY ("ticket_id")
);

-- CreateIndex
CREATE INDEX "otp_ticket_context_hotel_id_idx" ON "otp_ticket_context"("hotel_id");
