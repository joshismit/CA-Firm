-- CreateEnum
CREATE TYPE "integration_category" AS ENUM ('ACCOUNTING', 'STORAGE', 'COMMUNICATION', 'IDENTITY', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "integration_connection_status" AS ENUM ('DISCONNECTED', 'PENDING', 'CONNECTED', 'ERROR', 'EXPIRED');

-- CreateEnum
CREATE TYPE "integration_sync_direction" AS ENUM ('IMPORT', 'EXPORT', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "integration_sync_trigger" AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "integration_sync_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "integration_webhook_status" AS ENUM ('RECEIVED', 'VERIFIED', 'REJECTED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "integration_job_type" AS ENUM ('SYNC', 'WEBHOOK_PROCESSING', 'TOKEN_REFRESH', 'HEALTH_CHECK');

-- CreateEnum
CREATE TYPE "integration_job_status" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'DEAD_LETTER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_event_type" ADD VALUE 'INTEGRATION_CONNECTED';
ALTER TYPE "audit_event_type" ADD VALUE 'INTEGRATION_DISCONNECTED';
ALTER TYPE "audit_event_type" ADD VALUE 'INTEGRATION_CREDENTIAL_UPDATED';
ALTER TYPE "audit_event_type" ADD VALUE 'INTEGRATION_SYNC_TRIGGERED';
ALTER TYPE "audit_event_type" ADD VALUE 'INTEGRATION_SYNC_COMPLETED';
ALTER TYPE "audit_event_type" ADD VALUE 'INTEGRATION_SYNC_FAILED';
ALTER TYPE "audit_event_type" ADD VALUE 'INTEGRATION_TOKEN_REFRESHED';
ALTER TYPE "audit_event_type" ADD VALUE 'INTEGRATION_WEBHOOK_RECEIVED';

-- CreateTable
CREATE TABLE "integration_providers" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "integration_category" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "integration_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider_key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(150),
    "status" "integration_connection_status" NOT NULL DEFAULT 'DISCONNECTED',
    "encrypted_credentials" TEXT,
    "scopes" TEXT[],
    "token_expires_at" TIMESTAMPTZ,
    "config" JSONB NOT NULL DEFAULT '{}',
    "sync_direction" "integration_sync_direction" NOT NULL DEFAULT 'IMPORT',
    "auto_sync_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sync_frequency_minutes" INTEGER,
    "last_sync_at" TIMESTAMPTZ,
    "next_sync_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "metadata" JSONB,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_syncs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "direction" "integration_sync_direction" NOT NULL,
    "trigger" "integration_sync_trigger" NOT NULL,
    "status" "integration_sync_status" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(255) NOT NULL,
    "is_dry_run" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "items_succeeded" INTEGER NOT NULL DEFAULT 0,
    "items_failed" INTEGER NOT NULL DEFAULT 0,
    "conflict_count" INTEGER NOT NULL DEFAULT 0,
    "result_summary" JSONB,
    "error_message" TEXT,
    "triggered_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "integration_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_webhook_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "connection_id" UUID,
    "provider_key" VARCHAR(100) NOT NULL,
    "external_event_id" VARCHAR(255),
    "status" "integration_webhook_status" NOT NULL DEFAULT 'RECEIVED',
    "signature_valid" BOOLEAN,
    "headers" JSONB,
    "payload" JSONB,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "connection_id" UUID,
    "jobType" "integration_job_type" NOT NULL,
    "status" "integration_job_status" NOT NULL DEFAULT 'QUEUED',
    "queue_job_id" VARCHAR(255),
    "related_sync_id" UUID,
    "related_webhook_log_id" UUID,
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "scheduled_for" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "integration_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_providers_key_key" ON "integration_providers"("key");

-- CreateIndex
CREATE INDEX "idx_integration_providers_category" ON "integration_providers"("category");

-- CreateIndex
CREATE INDEX "idx_integration_connections_tenant_provider" ON "integration_connections"("tenant_id", "provider_key");

-- CreateIndex
CREATE INDEX "idx_integration_connections_tenant_status" ON "integration_connections"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_integration_connections_soft_delete" ON "integration_connections"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_integration_connections_next_sync" ON "integration_connections"("next_sync_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_syncs_idempotency_key_key" ON "integration_syncs"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_integration_syncs_tenant_connection" ON "integration_syncs"("tenant_id", "connection_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_integration_syncs_tenant_status" ON "integration_syncs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_integration_webhook_logs_tenant_timeline" ON "integration_webhook_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_integration_webhook_logs_status" ON "integration_webhook_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_webhook_logs_provider_key_external_event_id_key" ON "integration_webhook_logs"("provider_key", "external_event_id");

-- CreateIndex
CREATE INDEX "idx_integration_jobs_tenant_status" ON "integration_jobs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_integration_jobs_status_scheduled" ON "integration_jobs"("status", "scheduled_for");

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_provider_key_fkey" FOREIGN KEY ("provider_key") REFERENCES "integration_providers"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_syncs" ADD CONSTRAINT "integration_syncs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_webhook_logs" ADD CONSTRAINT "integration_webhook_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_related_sync_id_fkey" FOREIGN KEY ("related_sync_id") REFERENCES "integration_syncs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_related_webhook_log_id_fkey" FOREIGN KEY ("related_webhook_log_id") REFERENCES "integration_webhook_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
