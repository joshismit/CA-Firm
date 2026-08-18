-- CreateEnum
CREATE TYPE "lead_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_event_type" ADD VALUE 'LEAD_CREATED';
ALTER TYPE "audit_event_type" ADD VALUE 'LEAD_STAGE_CHANGED';
ALTER TYPE "audit_event_type" ADD VALUE 'LEAD_CONVERTED';
ALTER TYPE "audit_event_type" ADD VALUE 'LEAD_ASSIGNMENT_CHANGED';
ALTER TYPE "audit_event_type" ADD VALUE 'LEAD_NOTE_ADDED';
ALTER TYPE "audit_event_type" ADD VALUE 'FOLLOWUP_COMPLETED';
ALTER TYPE "audit_event_type" ADD VALUE 'BUSINESS_ASSIGNMENT_CHANGED';

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "website" VARCHAR(255);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "priority" "lead_priority";

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "lead_id" UUID;

-- CreateIndex
CREATE INDEX "leads_tenant_id_priority_idx" ON "leads"("tenant_id", "priority");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_lead_id_idx" ON "tasks"("tenant_id", "lead_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
