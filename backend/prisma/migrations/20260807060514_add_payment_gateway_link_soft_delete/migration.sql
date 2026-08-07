-- AlterTable
ALTER TABLE "payment_gateway_links" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "idx_payment_gateway_links_soft_delete" ON "payment_gateway_links"("tenant_id", "deleted_at");
