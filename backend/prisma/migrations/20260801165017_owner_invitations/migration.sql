-- AlterTable
ALTER TABLE "user_invitations" ADD COLUMN     "invited_by_master_admin_id" UUID,
ADD COLUMN     "is_owner" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "invited_by_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_master_admin_id_fkey" FOREIGN KEY ("invited_by_master_admin_id") REFERENCES "master_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: exactly one of invited_by_id / invited_by_master_admin_id must be set
ALTER TABLE "user_invitations" ADD CONSTRAINT "chk_invitation_single_inviter"
  CHECK (
    ("invited_by_id" IS NOT NULL AND "invited_by_master_admin_id" IS NULL) OR
    ("invited_by_id" IS NULL AND "invited_by_master_admin_id" IS NOT NULL)
  );
