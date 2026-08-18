-- CreateEnum
CREATE TYPE "task_reminder_type" AS ENUM ('DUE_TOMORROW', 'DUE_TODAY', 'OVERDUE');

-- AlterEnum
ALTER TYPE "audit_event_type" ADD VALUE 'TASK_REMINDER_SENT';

-- CreateTable
CREATE TABLE "task_reminders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "task_reminder_type" NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_reminders_tenant_id_task_id_idx" ON "task_reminders"("tenant_id", "task_id");

-- CreateIndex
CREATE INDEX "task_reminders_tenant_id_user_id_idx" ON "task_reminders"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_reminders_task_id_user_id_type_key" ON "task_reminders"("task_id", "user_id", "type");

-- AddForeignKey
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
