-- CreateEnum
CREATE TYPE "payment_gateway_provider_type" AS ENUM ('DISABLED', 'RAZORPAY');

-- CreateEnum
CREATE TYPE "payment_gateway_link_status" AS ENUM ('CREATED', 'PARTIALLY_PAID', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "firm_payment_gateway_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" "payment_gateway_provider_type" NOT NULL DEFAULT 'DISABLED',
    "key_id" VARCHAR(255),
    "encrypted_key_secret" TEXT,
    "encrypted_webhook_secret" TEXT,
    "is_test_mode" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "firm_payment_gateway_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_gateway_links" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "provider" "payment_gateway_provider_type" NOT NULL,
    "provider_payment_id" VARCHAR(100) NOT NULL,
    "url" TEXT NOT NULL,
    "amount_in_paise" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "status" "payment_gateway_link_status" NOT NULL DEFAULT 'CREATED',
    "expires_at" TIMESTAMPTZ,
    "provider_metadata" JSONB,
    "payment_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_gateway_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "firm_payment_gateway_settings_tenant_id_key" ON "firm_payment_gateway_settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateway_links_provider_payment_id_key" ON "payment_gateway_links"("provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateway_links_payment_id_key" ON "payment_gateway_links"("payment_id");

-- CreateIndex
CREATE INDEX "idx_payment_gateway_links_tenant_invoice" ON "payment_gateway_links"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "idx_payment_gateway_links_tenant_status" ON "payment_gateway_links"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "firm_payment_gateway_settings" ADD CONSTRAINT "firm_payment_gateway_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firm_payment_gateway_settings" ADD CONSTRAINT "firm_payment_gateway_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_gateway_links" ADD CONSTRAINT "payment_gateway_links_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_gateway_links" ADD CONSTRAINT "payment_gateway_links_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_gateway_links" ADD CONSTRAINT "payment_gateway_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
