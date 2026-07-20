/*
  Warnings:

  - The values [PASSWORD_RESET] on the enum `login_event_type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "login_event_type_new" AS ENUM ('LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'TOKEN_REFRESH', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_SUCCESS', 'MFA_SUCCESS', 'MFA_FAILED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'SESSION_REVOKED', 'EMAIL_CHANGED');
ALTER TABLE "login_history" ALTER COLUMN "event_type" TYPE "login_event_type_new" USING ("event_type"::text::"login_event_type_new");
ALTER TYPE "login_event_type" RENAME TO "login_event_type_old";
ALTER TYPE "login_event_type_new" RENAME TO "login_event_type";
DROP TYPE "public"."login_event_type_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "session_revoke_reason" ADD VALUE 'EMAIL_CHANGE';
ALTER TYPE "session_revoke_reason" ADD VALUE 'ACCOUNT_LOCKED';

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "require_email_verification" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "user_password_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_password_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_password_history_user" ON "user_password_history"("tenant_id", "user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_password_history" ADD CONSTRAINT "user_password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
