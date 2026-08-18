-- CreateEnum
CREATE TYPE "audit_event_type" AS ENUM ('UPLOAD', 'DOWNLOAD', 'SHARE', 'LOGIN', 'LOGOUT', 'ROLE_CHANGE', 'TASK_UPDATE', 'PAYMENT_ACTION', 'PERMISSION_CHANGE');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" "audit_event_type" NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_name" VARCHAR(200) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" UUID,
    "description" TEXT NOT NULL,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_logs_tenant_timeline" ON "audit_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_event_type" ON "audit_logs"("tenant_id", "event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs"("tenant_id", "actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_target" ON "audit_logs"("tenant_id", "target_type", "target_id");
