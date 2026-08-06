-- CreateEnum
CREATE TYPE "task_type" AS ENUM ('DOCUMENT_REQUEST', 'FILING', 'COMPLIANCE', 'PAYMENT_FOLLOW_UP', 'DOCUMENT_REVIEW', 'APPROVAL');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_event_type" ADD VALUE 'TASK_CREATED';
ALTER TYPE "audit_event_type" ADD VALUE 'TASK_ASSIGNED';
ALTER TYPE "audit_event_type" ADD VALUE 'TASK_SUBMITTED';
ALTER TYPE "audit_event_type" ADD VALUE 'TASK_APPROVED';
ALTER TYPE "audit_event_type" ADD VALUE 'TASK_REJECTED';
ALTER TYPE "audit_event_type" ADD VALUE 'TASK_COMPLETED';
ALTER TYPE "audit_event_type" ADD VALUE 'TASK_REOPENED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "permission_action" ADD VALUE 'REVIEW';
ALTER TYPE "permission_action" ADD VALUE 'COMPLETE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "task_status" ADD VALUE 'REQUESTED';
ALTER TYPE "task_status" ADD VALUE 'SUBMITTED';
ALTER TYPE "task_status" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "task_status" ADD VALUE 'APPROVED';
ALTER TYPE "task_status" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "approved_by" UUID,
ADD COLUMN     "business_id" UUID,
ADD COLUMN     "client_id" UUID,
ADD COLUMN     "completed_by" UUID,
ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "document_id" UUID,
ADD COLUMN     "folder_id" UUID,
ADD COLUMN     "priority" "task_priority",
ADD COLUMN     "rejected_by" UUID,
ADD COLUMN     "type" "task_type";

-- CreateTable
CREATE TABLE "task_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "task_type" NOT NULL,
    "title_template" VARCHAR(255) NOT NULL,
    "description_template" TEXT,
    "default_priority" "task_priority",
    "due_in_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "deleted_by" UUID,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_templates_tenant_id_type_idx" ON "task_templates"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "task_templates_tenant_id_is_active_idx" ON "task_templates"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "task_templates_tenant_id_deleted_at_idx" ON "task_templates"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_business_id_idx" ON "tasks"("tenant_id", "business_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_contact_id_idx" ON "tasks"("tenant_id", "contact_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_client_id_idx" ON "tasks"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_document_id_idx" ON "tasks"("tenant_id", "document_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_folder_id_idx" ON "tasks"("tenant_id", "folder_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_completed_by_idx" ON "tasks"("tenant_id", "completed_by");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_approved_by_idx" ON "tasks"("tenant_id", "approved_by");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_rejected_by_idx" ON "tasks"("tenant_id", "rejected_by");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_type_idx" ON "tasks"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_priority_idx" ON "tasks"("tenant_id", "priority");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "document_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
