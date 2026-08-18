-- CreateEnum
CREATE TYPE "document_approval_status" AS ENUM ('NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_event_type" ADD VALUE 'INVOICE_CREATED';
ALTER TYPE "audit_event_type" ADD VALUE 'INVOICE_UPDATED';
ALTER TYPE "audit_event_type" ADD VALUE 'INVOICE_DELETED';
ALTER TYPE "audit_event_type" ADD VALUE 'PAYMENT_COMPLETED';
ALTER TYPE "audit_event_type" ADD VALUE 'SUBSCRIPTION_UPDATED';
ALTER TYPE "audit_event_type" ADD VALUE 'FOLDER_CREATED';
ALTER TYPE "audit_event_type" ADD VALUE 'FOLDER_RENAMED';
ALTER TYPE "audit_event_type" ADD VALUE 'FOLDER_DELETED';
ALTER TYPE "audit_event_type" ADD VALUE 'DASHBOARD_PREFERENCES_CHANGED';
ALTER TYPE "audit_event_type" ADD VALUE 'DASHBOARD_LAYOUT_RESET';
ALTER TYPE "audit_event_type" ADD VALUE 'DASHBOARD_DEFAULTS_UPDATED';
ALTER TYPE "audit_event_type" ADD VALUE 'NOTIFICATION_TEMPLATE_CREATED';
ALTER TYPE "audit_event_type" ADD VALUE 'NOTIFICATION_TEMPLATE_UPDATED';
ALTER TYPE "audit_event_type" ADD VALUE 'NOTIFICATION_TEMPLATE_DELETED';
ALTER TYPE "audit_event_type" ADD VALUE 'DOCUMENT_APPROVED';
ALTER TYPE "audit_event_type" ADD VALUE 'DOCUMENT_REJECTED';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "new_value" JSONB,
ADD COLUMN     "old_value" JSONB,
ADD COLUMN     "user_agent" VARCHAR(500);

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "approval_status" "document_approval_status" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "review_comment" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMPTZ,
ADD COLUMN     "reviewer_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_manager" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "documents_tenant_id_approval_status_idx" ON "documents"("tenant_id", "approval_status");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
