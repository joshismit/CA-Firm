import { Invoice, ReminderCadenceType, AuditEventType, NotificationChannel, Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { AUDIT } from '@shared/constants';
import { getIsoWeekLabel } from '@shared/utils';
// Concrete path — see `modules/notifications/service/notification-dispatch.service.ts`'s identical comment for why.
import { AuditLogRecorder } from '@modules/audit/service/audit-log.recorder';
// Concrete path, not the `@modules/notifications` barrel — see
// `middlewares/tenant.middleware.ts`'s header comment for why.
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
// Concrete path — `BusinessAssignmentRepository` isn't in `@modules/business`'s public barrel,
// but reaching into it directly is already this codebase's established precedent for exactly
// this need (see e.g. `modules/documents/service/document-access-scope.service.ts`,
// `modules/dashboard/service/dashboard-aggregation.service.ts`).
import { BusinessAssignmentRepository } from '@modules/business/repository/business-assignment.repository';
import { InvoiceRepository } from '../repository/invoice.repository';
import { InvoiceReminderRepository } from '../repository/invoice-reminder.repository';

export type BillingReminderRunSummary = Record<ReminderCadenceType, number>;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDueDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatAmount(invoice: Invoice): string {
  const total = Number(invoice.amount) + Number(invoice.tax);
  return `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildReminderCopy(type: ReminderCadenceType, invoice: Invoice): { title: string; message: string } {
  // Non-null here — every candidate came from `InvoiceRepository.findReminderCandidates()`, which always filters on `dueDate`.
  const dueDate = formatDueDate(invoice.dueDate as Date);
  const amount = formatAmount(invoice);

  switch (type) {
    case ReminderCadenceType.DUE_IN_30_DAYS:
      return { title: 'Payment due in 30 days', message: `Invoice ${invoice.invoiceNumber} (${amount}) is due on ${dueDate}.` };
    case ReminderCadenceType.DUE_IN_7_DAYS:
      return { title: 'Payment due in 7 days', message: `Invoice ${invoice.invoiceNumber} (${amount}) is due on ${dueDate}.` };
    case ReminderCadenceType.DUE_TOMORROW:
      return { title: 'Payment due tomorrow', message: `Invoice ${invoice.invoiceNumber} (${amount}) is due tomorrow (${dueDate}).` };
    case ReminderCadenceType.OVERDUE:
      return { title: 'Payment overdue', message: `Invoice ${invoice.invoiceNumber} (${amount}) is overdue — it was due ${dueDate}.` };
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Billing Reminder Service (PRD §11.12 — payment reminders)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mirrors `modules/tasks/service/task-reminder.service.ts`'s exact shape —
 * explicit constructor DI, no `BaseService`/`Request` coupling (runs on a
 * schedule across every tenant, not per-request), `processReminders()` entry
 * point, batched candidate lookup + batched existing-reminder lookup, a
 * per-candidate `sendReminder()` that never throws. A deliberate, independent
 * copy — not a shared "ReminderEngine" — see `ReminderCadenceType`'s own
 * schema.prisma comment for why.
 *
 * Recipients: an `Invoice.businessId` resolves to every staff member
 * assigned to that Business (`BusinessAssignmentRepository.findByBusiness()`)
 * — there is no single "owner" of an invoice the way a `Task` has an
 * `assigneeId`, so every assignee gets the reminder. Channels `[IN_APP,
 * EMAIL]`, same reasoning as `TaskReminderService`'s own choice: a payment
 * deadline should reach someone outside the app.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class BillingReminderService {
  constructor(
    private readonly invoiceRepository: InvoiceRepository = new InvoiceRepository(prisma),
    private readonly invoiceReminderRepository: InvoiceReminderRepository = new InvoiceReminderRepository(prisma),
    private readonly businessAssignmentRepository: BusinessAssignmentRepository = new BusinessAssignmentRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
    private readonly notificationDispatchService: NotificationDispatchService = new NotificationDispatchService(),
  ) {}

  async processReminders(now: Date = new Date()): Promise<BillingReminderRunSummary> {
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

    const summary = {} as BillingReminderRunSummary;
    for (const type of Object.values(ReminderCadenceType)) {
      // eslint-disable-next-line no-await-in-loop -- exactly 4 iterations (one per cadence type); each type's dispatch must finish before the next type's idempotency check is meaningful.
      summary[type] = await this.processType(type, dueDateRangeByType[type], bucketByType[type]);
    }

    logger.info(summary, 'Billing reminder scan complete');
    return summary;
  }

  private async processType(type: ReminderCadenceType, dueDateRange: { gte?: Date; lt?: Date }, bucket: string): Promise<number> {
    const candidates = await this.invoiceRepository.findReminderCandidates(dueDateRange, { ignoreTenant: true });
    if (candidates.length === 0) return 0;

    const existing = await this.invoiceReminderRepository.findExisting(
      candidates.map((invoice) => invoice.id),
      type,
      bucket,
      { ignoreTenant: true },
    );
    const alreadySent = new Set(existing.map((row) => `${row.invoiceId}:${row.userId}`));

    let sentCount = 0;
    for (const invoice of candidates) {
      // eslint-disable-next-line no-await-in-loop -- each invoice's recipient resolution + dispatch must complete before the next; per-tenant/per-run volume is bounded by real due-invoice counts.
      const assignments = await this.businessAssignmentRepository.findByBusiness(invoice.businessId as string, { ignoreTenant: true });

      for (const assignment of assignments) {
        if (alreadySent.has(`${invoice.id}:${assignment.userId}`)) continue;

        // eslint-disable-next-line no-await-in-loop -- see above.
        const sent = await this.sendReminder(invoice, assignment.userId, type, bucket);
        if (sent) sentCount += 1;
      }
    }

    return sentCount;
  }

  /** Never throws — every failure mode is logged and treated as "this reminder didn't go out this run," not a reason to abort the rest of the scan. */
  private async sendReminder(invoice: Invoice, userId: string, type: ReminderCadenceType, bucket: string): Promise<boolean> {
    const { title, message } = buildReminderCopy(type, invoice);

    try {
      await this.notificationDispatchService.send({
        tenantId: invoice.tenantId,
        userId,
        title,
        message,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      });
    } catch (err) {
      logger.warn({ err, invoiceId: invoice.id, userId, type }, 'Failed to dispatch billing reminder notification — a future scan may retry it');
      return false;
    }

    try {
      await this.invoiceReminderRepository.record({ invoiceId: invoice.id, userId, type, bucket }, { tenantId: invoice.tenantId });
    } catch (err) {
      if (this.isDuplicateReminder(err)) {
        logger.debug({ invoiceId: invoice.id, userId, type }, 'Billing reminder already recorded by a concurrent run — the notification just sent was a harmless duplicate');
      } else {
        logger.warn({ err, invoiceId: invoice.id, userId, type }, 'Failed to record billing reminder — a future scan may resend it');
      }
      return false;
    }

    await this.auditLogRecorder.record({
      tenantId: invoice.tenantId,
      actorId: AUDIT.SYSTEM_ACTOR_ID,
      actorName: AUDIT.SYSTEM_ACTOR_NAME,
      eventType: AuditEventType.BILLING_REMINDER_SENT,
      description: `Sent "${type}" payment reminder for invoice "${invoice.invoiceNumber}"`,
      targetType: 'Invoice',
      targetId: invoice.id,
      ipAddress: null,
    });

    return true;
  }

  private isDuplicateReminder(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
}
