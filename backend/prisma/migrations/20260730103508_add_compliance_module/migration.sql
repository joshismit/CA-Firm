-- CreateEnum
CREATE TYPE "compliance_category" AS ENUM ('GST', 'ITR', 'TDS', 'MCA');

-- CreateEnum
CREATE TYPE "compliance_filing_status" AS ENUM ('DRAFT', 'PENDING', 'FILED', 'OVERDUE');

-- CreateTable
CREATE TABLE "compliance_filings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category" "compliance_category" NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "period" VARCHAR(50) NOT NULL,
    "status" "compliance_filing_status" NOT NULL DEFAULT 'DRAFT',
    "due_date" TIMESTAMPTZ,
    "filed_date" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "compliance_filings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_compliance_tenant_category_status" ON "compliance_filings"("tenant_id", "category", "status");

-- CreateIndex
CREATE INDEX "idx_compliance_soft_delete" ON "compliance_filings"("tenant_id", "category", "deleted_at");

-- CreateIndex
CREATE INDEX "compliance_filings_reference_idx" ON "compliance_filings" USING GIN ("reference" gin_trgm_ops);
