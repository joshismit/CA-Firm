-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_event_type" ADD VALUE 'SHARE_REVOKED';
ALTER TYPE "audit_event_type" ADD VALUE 'DOCUMENT_DELETE';
ALTER TYPE "audit_event_type" ADD VALUE 'FAILED_LOGIN';
ALTER TYPE "audit_event_type" ADD VALUE 'SESSION_REVOKED';

-- AlterEnum
ALTER TYPE "refresh_token_revoke_reason" ADD VALUE 'CONCURRENT_LIMIT_EXCEEDED';

-- AlterEnum
ALTER TYPE "session_revoke_reason" ADD VALUE 'CONCURRENT_LIMIT_EXCEEDED';
