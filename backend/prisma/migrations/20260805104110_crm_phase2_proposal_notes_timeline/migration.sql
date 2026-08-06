-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_event_type" ADD VALUE 'PROPOSAL_SENT';
ALTER TYPE "audit_event_type" ADD VALUE 'PROPOSAL_ACCEPTED';
ALTER TYPE "audit_event_type" ADD VALUE 'PROPOSAL_REJECTED';
ALTER TYPE "audit_event_type" ADD VALUE 'BUSINESS_NOTE_ADDED';
ALTER TYPE "audit_event_type" ADD VALUE 'BUSINESS_PAN_UPDATED';
ALTER TYPE "audit_event_type" ADD VALUE 'BUSINESS_GST_UPDATED';
ALTER TYPE "audit_event_type" ADD VALUE 'BUSINESS_DETAILS_UPDATED';

-- AlterEnum
ALTER TYPE "contact_role_type" ADD VALUE 'DECISION_MAKER';

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "din" VARCHAR(20),
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "phone" VARCHAR(30),
ADD COLUMN     "tan" VARCHAR(10),
ADD COLUMN     "trade_name" VARCHAR(255);

-- AlterTable
ALTER TABLE "lead_assignments" ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "interested_services" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "proposal_accepted_at" TIMESTAMPTZ,
ADD COLUMN     "proposal_rejected_at" TIMESTAMPTZ,
ADD COLUMN     "proposal_remarks" TEXT,
ADD COLUMN     "proposal_sent_at" TIMESTAMPTZ,
ADD COLUMN     "proposal_value" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "business_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "document_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "business_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_notes_business_id_created_at_idx" ON "business_notes"("business_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "business_notes_tenant_id_document_id_idx" ON "business_notes"("tenant_id", "document_id");

-- CreateIndex
CREATE INDEX "lead_assignments_lead_id_is_primary_idx" ON "lead_assignments"("lead_id", "is_primary");

-- AddForeignKey
ALTER TABLE "business_notes" ADD CONSTRAINT "business_notes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_notes" ADD CONSTRAINT "business_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_notes" ADD CONSTRAINT "business_notes_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
