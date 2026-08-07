import { AuditEventType, Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { AuditLogRepository } from '../repository/audit-log.repository';

export interface RecordAuditEventParams {
  tenantId: string;
  actorId: string;
  eventType: AuditEventType;
  description: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
  /**
   * Skips the `User` lookup below and uses this name directly. For every
   * request-driven caller, omit this and get the existing looked-up-name
   * behavior. The one caller that sets it is `TaskReminderService`, whose
   * `actorId` is `AUDIT.SYSTEM_ACTOR_ID` — a sentinel with no matching `User`
   * row, which would otherwise resolve to the misleading `'Unknown'` fallback
   * instead of `AUDIT.SYSTEM_ACTOR_NAME` ('System').
   */
  actorName?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Audit Log Recorder (write side, PRD §14.1)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The one write path other modules' services call to record a
 * security-relevant event — auth (login/logout), documents (upload/
 * download), roles (assign/revoke, permission grant changes), tasks (status
 * updates), and client-billing (payment actions). Each caller injects this
 * as an ordinary constructor dependency (`= new AuditLogRecorder()`), the
 * same DI convention every other cross-module composition in this codebase
 * uses (e.g. `DocumentService`'s `S3StorageService`).
 *
 * Takes fully explicit `tenantId`/`actorId` rather than reading them off
 * `BaseService`'s `this.tenantId`/`this.userId`, because not every calling
 * context has those populated the same way — `AuthService.login()` in
 * particular runs before `tenantMiddleware` (and before `authMiddleware`
 * populates `req.user`), so the tenant/actor there only exist as local
 * variables (the freshly-looked-up `user` row), not as request context.
 *
 * `actorName` is resolved here (one extra `User` lookup) rather than
 * requiring every caller to pass it, since most call sites don't already
 * have the acting user's name in hand — only their ID.
 *
 * Deliberately swallows its own errors (logs a warning, never throws) —
 * this is best-effort observability, not part of the primary business
 * transaction. A caller's role assignment, task update, or payment must
 * still succeed even if this secondary write fails (e.g. a transient DB
 * hiccup); mirrors `UserService.queueInvitationEmail()`'s reasoning for the
 * same category of "must not block/fail the primary action" side effect,
 * adapted to a synchronous `await` here since the write needs to have
 * actually landed before ordinary request logging/tests can observe it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class AuditLogRecorder {
  constructor(private readonly repository: AuditLogRepository = new AuditLogRepository(prisma)) {}

  async record(params: RecordAuditEventParams): Promise<void> {
    try {
      const actorName = params.actorName ?? (await this.resolveActorName(params.actorId, params.tenantId));

      await this.repository.record(
        {
          eventType: params.eventType,
          actorId: params.actorId,
          actorName,
          targetType: params.targetType ?? null,
          targetId: params.targetId ?? null,
          description: params.description,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          oldValue: params.oldValue ?? null,
          newValue: params.newValue ?? null,
          metadata: params.metadata ?? null,
        },
        { tenantId: params.tenantId },
      );
    } catch (err) {
      logger.warn({ err, eventType: params.eventType, tenantId: params.tenantId }, 'Failed to record audit log entry');
    }
  }

  private async resolveActorName(actorId: string, tenantId: string): Promise<string> {
    const actor = await prisma.user.findFirst({
      where: { id: actorId, tenantId },
      select: { firstName: true, lastName: true },
    });
    return actor ? `${actor.firstName} ${actor.lastName}`.trim() : 'Unknown';
  }
}
