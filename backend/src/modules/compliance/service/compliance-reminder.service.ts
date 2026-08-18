import { ComplianceFiling, ReminderCadenceType, AuditEventType, NotificationChannel, Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { AUDIT } from '@shared/constants';
import { getIsoWeekLabel } from '@shared/utils';
// Concrete path — see `modules/notifications/service/notification-dispatch.service.ts`'s identical comment for why.
import { AuditLogRecorder } from '@modules/audit/service/audit-log.recorder';
// Concrete path — see `middlewares/tenant.middleware.ts`'s header comment for why.
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
// Concrete path — see `BillingReminderService`'s identical comment for why this is already the
// established precedent for reaching `BusinessAssignmentRepository` from outside its own module.
import { BusinessAssignmentRepository } from '@modules/business/repository/business-assignment.repository';
import { ComplianceFilingRepository } from '../repository/compliance-filing.repository';
import { ComplianceReminderRepository } from '../repository/compliance-reminder.repository';

export type ComplianceReminderRunSummary = Record<ReminderCadenceType, number>;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDueDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function buildReminderCopy(type: ReminderCadenceType, filing: ComplianceFiling): { title: string; message: string } {
  // Non-null here — every candidate came from `ComplianceFilingRepository.findReminderCandidates()`, which always filters on `dueDate`.
  const dueDate = formatDueDate(filing.dueDate as Date);
  const label = `${filing.category} filing "${filing.reference}" (${filing.period})`;

  switch (type) {
    case ReminderCadenceType.DUE_IN_30_DAYS:
      return { title: `${filing.category} filing due in 30 days`, message: `${label} is due on ${dueDate}.` };
    case ReminderCadenceType.DUE_IN_7_DAYS:
      return { title: `${filing.category} filing due in 7 days`, message: `${label} is due on ${dueDate}.` };
    case ReminderCadenceType.DUE_TOMORROW:
      return { title: `${filing.category} filing due tomorrow`, message: `${label} is due tomorrow (${dueDate}).` };
    case ReminderCadenceType.OVERDUE:
      return { title: `${filing.category} filing overdue`, message: `${label} is overdue — it was due ${dueDate}.` };
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Compliance Reminder Service (PRD §11.12 — GST/ITR/TDS/MCA filing reminders)
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirrors `BillingReminderService`'s exact shape (itself mirroring
 * `TaskReminderService`) — an independent copy, not a shared engine, see
 * `ReminderCadenceType`'s schema.prisma comment. Recipients resolve via
 * `ComplianceFiling.businessId` → every assigned staff member, same
 * reasoning as billing reminders. Only filings with a non-null `businessId`
 * are candidates at all — see that column's own schema comment.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ComplianceReminderService {
  constructor(
    private readonly filingRepository: ComplianceFilingRepository = new ComplianceFilingRepository(prisma),
    private readonly reminderRepository: ComplianceReminderRepository = new ComplianceReminderRepository(prisma),
    private readonly businessAssignmentRepository: BusinessAssignmentRepository = new BusinessAssignmentRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
    private readonly notificationDispatchService: NotificationDispatchService = new NotificationDispatchService(),
  ) {}

  async processReminders(now: Date = new Date()): Promise<ComplianceReminderRunSummary> {
    const todayStart = startOfUtcDay(now);
    const tomorrowStart = addUtcDays(todayStart, 1);
    const dayAfterTomorrowStart = addUtcDays(todayStart, 2);
    const in7DaysStart = addUtcDays(todayStart, 7);
    const in8DaysStart = addUtcDays(todayStart, 8);
    const in30DaysStart = addUtcDays(todayStart, 30);
    const in31DaysStart = addUtcDays(todayStart, 31);

    const dueDateRangeByType: Record<ReminderCadenceType, { gte?: Date; lt?: Date }> = {
      [ReminderCadenceType.DUE_TOMORROW]: { gte: tomorrowStart, lt: dayAfterTomorrowStart },
      [ReminderCadenceType.DUE_IN_7_DAYS]: { gte: in7DaysStart, lt: in8DaysStart },
      [ReminderCadenceType.DUE_IN_30_DAYS]: { gte: in30DaysStart, lt: in31DaysStart },
      [ReminderCadenceType.OVERDUE]: { lt: todayStart },
    };
    const bucketByType: Record<ReminderCadenceType, string> = {
      [ReminderCadenceType.DUE_TOMORROW]: '',
      [ReminderCadenceType.DUE_IN_7_DAYS]: '',
      [ReminderCadenceType.DUE_IN_30_DAYS]: '',
      [ReminderCadenceType.OVERDUE]: getIsoWeekLabel(now),
    };

    const summary = {} as ComplianceReminderRunSummary;
    for (const type of Object.values(ReminderCadenceType)) {
      // eslint-disable-next-line no-await-in-loop -- exactly 4 iterations (one per cadence type).
      summary[type] = await this.processType(type, dueDateRangeByType[type], bucketByType[type]);
    }

    logger.info(summary, 'Compliance reminder scan complete');
    return summary;
  }

  private async processType(type: ReminderCadenceType, dueDateRange: { gte?: Date; lt?: Date }, bucket: string): Promise<number> {
    const candidates = await this.filingRepository.findReminderCandidates(dueDateRange, { ignoreTenant: true });
    if (candidates.length === 0) return 0;

    const existing = await this.reminderRepository.findExisting(
      candidates.map((filing) => filing.id),
      type,
      bucket,
      { ignoreTenant: true },
    );
    const alreadySent = new Set(existing.map((row) => `${row.complianceFilingId}:${row.userId}`));

    let sentCount = 0;
    for (const filing of candidates) {
      // eslint-disable-next-line no-await-in-loop -- see BillingReminderService's identical comment.
      const assignments = await this.businessAssignmentRepository.findByBusiness(filing.businessId as string, { ignoreTenant: true });

      for (const assignment of assignments) {
        if (alreadySent.has(`${filing.id}:${assignment.userId}`)) continue;

        // eslint-disable-next-line no-await-in-loop -- see above.
        const sent = await this.sendReminder(filing, assignment.userId, type, bucket);
        if (sent) sentCount += 1;
      }
    }

    return sentCount;
  }

  private async sendReminder(filing: ComplianceFiling, userId: string, type: ReminderCadenceType, bucket: string): Promise<boolean> {
    const { title, message } = buildReminderCopy(type, filing);

    try {
      await this.notificationDispatchService.send({
        tenantId: filing.tenantId,
        userId,
        title,
        message,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      });
    } catch (err) {
      logger.warn({ err, filingId: filing.id, userId, type }, 'Failed to dispatch compliance reminder notification — a future scan may retry it');
      return false;
    }

    try {
      await this.reminderRepository.record({ complianceFilingId: filing.id, userId, type, bucket }, { tenantId: filing.tenantId });
    } catch (err) {
      if (this.isDuplicateReminder(err)) {
        logger.debug({ filingId: filing.id, userId, type }, 'Compliance reminder already recorded by a concurrent run — the notification just sent was a harmless duplicate');
      } else {
        logger.warn({ err, filingId: filing.id, userId, type }, 'Failed to record compliance reminder — a future scan may resend it');
      }
      return false;
    }

    await this.auditLogRecorder.record({
      tenantId: filing.tenantId,
      actorId: AUDIT.SYSTEM_ACTOR_ID,
      actorName: AUDIT.SYSTEM_ACTOR_NAME,
      eventType: AuditEventType.COMPLIANCE_REMINDER_SENT,
      description: `Sent "${type}" reminder for ${filing.category} filing "${filing.reference}"`,
      targetType: 'ComplianceFiling',
      targetId: filing.id,
      ipAddress: null,
    });

    return true;
  }

  private isDuplicateReminder(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
}
