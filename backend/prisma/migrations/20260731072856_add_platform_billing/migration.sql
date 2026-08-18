-- CreateEnum
CREATE TYPE "billing_cycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "platform_invoice_status" AS ENUM ('PENDING', 'PAID', 'FAILED', 'VOID');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "billing_cycle" "billing_cycle" NOT NULL,
    "price_in_paise" INTEGER NOT NULL,
    "max_users" INTEGER,
    "max_clients" INTEGER,
    "max_storage_gb" INTEGER,
    "max_documents" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "billing_cycle" "billing_cycle" NOT NULL,
    "amount_in_paise" INTEGER NOT NULL,
    "status" "platform_invoice_status" NOT NULL DEFAULT 'PENDING',
    "razorpay_order_id" VARCHAR(100) NOT NULL,
    "razorpay_payment_id" VARCHAR(100),
    "razorpay_signature" VARCHAR(255),
    "period_start" TIMESTAMPTZ,
    "period_end" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "platform_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "plans_is_active_display_order_idx" ON "plans"("is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "platform_invoices_razorpay_order_id_key" ON "platform_invoices"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_invoices_razorpay_payment_id_key" ON "platform_invoices"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "idx_platform_invoices_tenant_status" ON "platform_invoices"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_platform_invoices_tenant_created" ON "platform_invoices"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
