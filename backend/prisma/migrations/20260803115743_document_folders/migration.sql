-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "folder_id" UUID;

-- CreateTable
CREATE TABLE "document_folders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "category" "document_category" NOT NULL,
    "parent_folder_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_folders_tenant_id_business_id_category_idx" ON "document_folders"("tenant_id", "business_id", "category");

-- CreateIndex
CREATE INDEX "document_folders_tenant_id_parent_folder_id_idx" ON "document_folders"("tenant_id", "parent_folder_id");

-- CreateIndex
CREATE INDEX "document_folders_tenant_id_deleted_at_idx" ON "document_folders"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_folders_tenant_id_business_id_category_parent_fold_key" ON "document_folders"("tenant_id", "business_id", "category", "parent_folder_id", "name");

-- CreateIndex
CREATE INDEX "documents_tenant_id_folder_id_idx" ON "documents"("tenant_id", "folder_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "document_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "document_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
