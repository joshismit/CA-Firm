-- CreateEnum
CREATE TYPE "calendar_event_type" AS ENUM ('CLIENT_MEETING', 'INTERNAL_MEETING', 'CALL', 'APPOINTMENT', 'AUDIT', 'REVIEW', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_event_type" ADD VALUE 'CALENDAR_EVENT_CREATED';
ALTER TYPE "audit_event_type" ADD VALUE 'CALENDAR_EVENT_UPDATED';
ALTER TYPE "audit_event_type" ADD VALUE 'CALENDAR_EVENT_DELETED';

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "event_type" "calendar_event_type" NOT NULL DEFAULT 'OTHER',
    "location" VARCHAR(255),
    "meeting_url" VARCHAR(500),
    "business_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" UUID,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_attendees" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_tenant_id_start_at_idx" ON "calendar_events"("tenant_id", "start_at");

-- CreateIndex
CREATE INDEX "calendar_events_tenant_id_business_id_idx" ON "calendar_events"("tenant_id", "business_id");

-- CreateIndex
CREATE INDEX "calendar_events_tenant_id_created_by_id_idx" ON "calendar_events"("tenant_id", "created_by_id");

-- CreateIndex
CREATE INDEX "calendar_events_tenant_id_deleted_at_idx" ON "calendar_events"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "calendar_event_attendees_tenant_id_user_id_idx" ON "calendar_event_attendees"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_attendees_event_id_user_id_key" ON "calendar_event_attendees"("event_id", "user_id");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
