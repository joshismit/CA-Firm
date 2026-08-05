-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_event_type" ADD VALUE 'SETTINGS_UPDATE';
ALTER TYPE "audit_event_type" ADD VALUE 'UPLOAD_REJECTED';

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "storage_quota_mb" INTEGER;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retention_until" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "max_upload_size_mb" INTEGER;

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "default_business_storage_quota_mb" INTEGER;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "max_upload_size_mb" INTEGER;

-- CreateIndex
CREATE INDEX "documents_tenant_id_archived_idx" ON "documents"("tenant_id", "archived");
