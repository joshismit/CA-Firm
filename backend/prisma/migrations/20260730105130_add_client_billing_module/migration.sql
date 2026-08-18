-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "expense_status" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "client_id" UUID,
    "business_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "issued_date" TIMESTAMPTZ,
    "due_date" TIMESTAMPTZ,
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "expense_number" VARCHAR(50) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "vendor" VARCHAR(255),
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMPTZ,
    "payment_method" VARCHAR(50),
    "status" "expense_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_number" VARCHAR(50) NOT NULL,
    "invoice_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" VARCHAR(50),
    "reference" VARCHAR(100),
    "paid_date" TIMESTAMPTZ,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_invoices_tenant_status" ON "invoices"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_invoices_tenant_client" ON "invoices"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "idx_invoices_tenant_business" ON "invoices"("tenant_id", "business_id");

-- CreateIndex
CREATE INDEX "idx_invoices_soft_delete" ON "invoices"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "invoices_invoice_number_idx" ON "invoices" USING GIN ("invoice_number" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_invoice_number_key" ON "invoices"("tenant_id", "invoice_number");

-- CreateIndex
CREATE INDEX "idx_expenses_tenant_status" ON "expenses"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_expenses_tenant_category" ON "expenses"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "idx_expenses_soft_delete" ON "expenses"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "expenses_expense_number_idx" ON "expenses" USING GIN ("expense_number" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "expenses_tenant_id_expense_number_key" ON "expenses"("tenant_id", "expense_number");

-- CreateIndex
CREATE INDEX "idx_payments_tenant_status" ON "payments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_payments_tenant_invoice" ON "payments"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "idx_payments_soft_delete" ON "payments"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "payments_payment_number_idx" ON "payments" USING GIN ("payment_number" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenant_id_payment_number_key" ON "payments"("tenant_id", "payment_number");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
