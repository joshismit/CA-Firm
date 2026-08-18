-- CreateEnum
CREATE TYPE "document_request_status" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "notification_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "notification_digest_frequency" AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY', 'DISABLED');

-- CreateEnum
CREATE TYPE "reminder_cadence_type" AS ENUM ('DUE_IN_30_DAYS', 'DUE_IN_7_DAYS', 'DUE_TOMORROW', 'OVERDUE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_event_type" ADD VALUE 'NOTIFICATION_CREATED';
ALTER TYPE "audit_event_type" ADD VALUE 'NOTIFICATION_SENT';
ALTER TYPE "audit_event_type" ADD VALUE 'NOTIFICATION_DELIVERED';
ALTER TYPE "audit_event_type" ADD VALUE 'NOTIFICATION_FAILED';
ALTER TYPE "audit_event_type" ADD VALUE 'NOTIFICATION_CANCELLED';
ALTER TYPE "audit_event_type" ADD VALUE 'NOTIFICATION_READ';
ALTER TYPE "audit_event_type" ADD VALUE 'NOTIFICATION_RETRIED';
ALTER TYPE "audit_event_type" ADD VALUE 'BILLING_REMINDER_SENT';
ALTER TYPE "audit_event_type" ADD VALUE 'COMPLIANCE_REMINDER_SENT';
ALTER TYPE "audit_event_type" ADD VALUE 'DOCUMENT_REMINDER_SENT';

-- AlterEnum
ALTER TYPE "notification_status" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "compliance_filings" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "cancelled_at" TIMESTAMPTZ,
ADD COLUMN     "dedupe_key" TEXT,
ADD COLUMN     "delivered_at" TIMESTAMPTZ,
ADD COLUMN     "priority" "notification_priority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "provider_message_id" TEXT,
ADD COLUMN     "provider_response" JSONB,
ADD COLUMN     "read_at" TIMESTAMPTZ,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduled_for" TIMESTAMPTZ,
ADD COLUMN     "sent_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "document_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "category" "document_category" NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMPTZ,
    "status" "document_request_status" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" UUID NOT NULL,
    "fulfilled_document_id" UUID,
    "fulfilled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "key" VARCHAR(100) NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "subject_template" VARCHAR(255),
    "body_template_text" TEXT NOT NULL,
    "body_template_html" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "deleted_by" UUID,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT true,
    "digest_frequency" "notification_digest_frequency" NOT NULL DEFAULT 'IMMEDIATE',
    "quiet_hours_start" INTEGER,
    "quiet_hours_end" INTEGER,
    "mute_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firm_notification_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_quiet_hours_start" INTEGER,
    "default_quiet_hours_end" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "firm_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_reminders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "reminder_cadence_type" NOT NULL,
    "bucket" VARCHAR(20) NOT NULL DEFAULT '',
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_reminders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "compliance_filing_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "reminder_cadence_type" NOT NULL,
    "bucket" VARCHAR(20) NOT NULL DEFAULT '',
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_request_reminders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "reminder_cadence_type" NOT NULL,
    "bucket" VARCHAR(20) NOT NULL DEFAULT '',
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_request_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_requests_tenant_id_business_id_idx" ON "document_requests"("tenant_id", "business_id");

-- CreateIndex
CREATE INDEX "document_requests_tenant_id_status_idx" ON "document_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "document_requests_tenant_id_deleted_at_idx" ON "document_requests"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "notification_templates_key_channel_idx" ON "notification_templates"("key", "channel");

-- CreateIndex
CREATE INDEX "notification_templates_tenant_id_is_active_idx" ON "notification_templates"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_tenant_id_key_channel_key" ON "notification_templates"("tenant_id", "key", "channel");

-- CreateIndex
-- The plain unique index above allows unlimited duplicate GLOBAL rows (tenant_id IS NULL) for
-- the same (key, channel) — Postgres treats NULLs as distinct in a unique index. This partial
-- index is the actual global-uniqueness guarantee (see NotificationTemplate's schema.prisma doc
-- comment).
CREATE UNIQUE INDEX "uq_notification_template_global_key_channel" ON "notification_templates"("key", "channel") WHERE "tenant_id" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "idx_notification_preferences_tenant" ON "notification_preferences"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "firm_notification_settings_tenant_id_key" ON "firm_notification_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "invoice_reminders_tenant_id_invoice_id_idx" ON "invoice_reminders"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "invoice_reminders_tenant_id_user_id_idx" ON "invoice_reminders"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_reminders_invoice_id_user_id_type_bucket_key" ON "invoice_reminders"("invoice_id", "user_id", "type", "bucket");

-- CreateIndex
CREATE INDEX "compliance_reminders_tenant_id_compliance_filing_id_idx" ON "compliance_reminders"("tenant_id", "compliance_filing_id");

-- CreateIndex
CREATE INDEX "compliance_reminders_tenant_id_user_id_idx" ON "compliance_reminders"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_reminders_compliance_filing_id_user_id_type_buck_key" ON "compliance_reminders"("compliance_filing_id", "user_id", "type", "bucket");

-- CreateIndex
CREATE INDEX "document_request_reminders_tenant_id_document_request_id_idx" ON "document_request_reminders"("tenant_id", "document_request_id");

-- CreateIndex
CREATE INDEX "document_request_reminders_tenant_id_user_id_idx" ON "document_request_reminders"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_request_reminders_document_request_id_user_id_type_key" ON "document_request_reminders"("document_request_id", "user_id", "type", "bucket");

-- CreateIndex
CREATE INDEX "idx_compliance_tenant_business" ON "compliance_filings"("tenant_id", "business_id");

-- CreateIndex
CREATE INDEX "idx_notifications_dedupe" ON "notifications"("tenant_id", "user_id", "channel", "dedupe_key");

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_fulfilled_document_id_fkey" FOREIGN KEY ("fulfilled_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_filings" ADD CONSTRAINT "compliance_filings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_reminders" ADD CONSTRAINT "compliance_reminders_compliance_filing_id_fkey" FOREIGN KEY ("compliance_filing_id") REFERENCES "compliance_filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_reminders" ADD CONSTRAINT "compliance_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_request_reminders" ADD CONSTRAINT "document_request_reminders_document_request_id_fkey" FOREIGN KEY ("document_request_id") REFERENCES "document_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_request_reminders" ADD CONSTRAINT "document_request_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
