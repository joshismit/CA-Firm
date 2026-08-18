-- AlterEnum
ALTER TYPE "audit_event_type" ADD VALUE 'VERSION_CREATE';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "is_latest_version" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "previous_version_id" UUID,
ADD COLUMN     "root_document_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "documents_previous_version_id_key" ON "documents"("previous_version_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_root_document_id_idx" ON "documents"("tenant_id", "root_document_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_root_document_id_fkey" FOREIGN KEY ("root_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

