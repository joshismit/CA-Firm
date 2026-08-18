-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "deleted_by" UUID;

-- CreateIndex
CREATE INDEX "leads_tenant_id_deleted_at_idx" ON "leads"("tenant_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
