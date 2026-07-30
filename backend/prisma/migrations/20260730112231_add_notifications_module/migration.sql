-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'PENDING',
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_notifications_user_unread" ON "notifications"("tenant_id", "user_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_notifications_user_status" ON "notifications"("tenant_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "idx_notifications_user_created" ON "notifications"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_soft_delete" ON "notifications"("tenant_id", "user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "notifications_title_idx" ON "notifications" USING GIN ("title" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
