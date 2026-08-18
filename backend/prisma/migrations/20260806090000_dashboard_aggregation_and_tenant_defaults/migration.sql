-- AlterTable
ALTER TABLE "dashboard_preferences" ADD COLUMN     "refresh_interval_seconds" INTEGER;

-- CreateTable
CREATE TABLE "dashboard_tenant_defaults" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "widgets" JSONB NOT NULL DEFAULT '[]',
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dashboard_tenant_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_tenant_defaults_tenant_id_role_key" ON "dashboard_tenant_defaults"("tenant_id", "role");

-- CreateIndex
CREATE INDEX "idx_dashboard_tenant_defaults_tenant" ON "dashboard_tenant_defaults"("tenant_id");

-- AddForeignKey
ALTER TABLE "dashboard_tenant_defaults" ADD CONSTRAINT "dashboard_tenant_defaults_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_tenant_defaults" ADD CONSTRAINT "dashboard_tenant_defaults_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
