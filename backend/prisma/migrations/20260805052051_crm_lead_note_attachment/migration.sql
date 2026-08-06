-- AlterTable
ALTER TABLE "lead_notes" ADD COLUMN     "document_id" UUID;

-- CreateIndex
CREATE INDEX "lead_notes_tenant_id_document_id_idx" ON "lead_notes"("tenant_id", "document_id");

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
