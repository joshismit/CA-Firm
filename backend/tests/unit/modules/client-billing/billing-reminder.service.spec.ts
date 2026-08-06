/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { Invoice, InvoiceStatus, ReminderCadenceType, AuditEventType, NotificationChannel, Prisma } from '@prisma/client';
import { logger } from '@config/logger';
import { AUDIT } from '@shared/constants';
import { BillingReminderService } from '@modules/client-billing/service/billing-reminder.service';
import { InvoiceRepository } from '@modules/client-billing/repository/invoice.repository';
import { InvoiceReminderRepository } from '@modules/client-billing/repository/invoice-reminder.repository';
import { AuditLogRecorder } from '@modules/audit/service/audit-log.recorder';
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { BusinessAssignmentRepository } from '@modules/business/repository/business-assignment.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BillingReminderService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirrors `tests/unit/modules/tasks/task-reminder.service.spec.ts` — every
 * collaborator is fully mocked. Covers the 4-bucket due-date range math, the
 * ISO-week `bucket` for OVERDUE, the assignment-based recipient fan-out
 * (unlike Task's single `assigneeId`), idempotency, and that one invoice's
 * failure never aborts the rest of the scan.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_A = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_A = 'user-33333333-3333-3333-3333-333333333333';
const USER_B = 'user-44444444-4444-4444-4444-444444444444';
const BUSINESS_ID = 'business-55555555-5555-5555-5555-555555555555';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const TODAY = new Date('2026-06-15T00:00:00.000Z');
const TOMORROW = new Date('2026-06-16T00:00:00.000Z');
const DAY_AFTER_TOMORROW = new Date('2026-06-17T00:00:00.000Z');
const IN_7_DAYS = new Date('2026-06-22T00:00:00.000Z');
const IN_8_DAYS = new Date('2026-06-23T00:00:00.000Z');
const IN_30_DAYS = new Date('2026-07-15T00:00:00.000Z');
const IN_31_DAYS = new Date('2026-07-16T00:00:00.000Z');

type MockedInvoiceRepository = { findReminderCandidates: jest.Mock };
type MockedInvoiceReminderRepository = { findExisting: jest.Mock; record: jest.Mock };
type MockedBusinessAssignmentRepository = { findByBusiness: jest.Mock };
type MockedAuditLogRecorder = { record: jest.Mock };
type MockedNotificationDispatchService = { send: jest.Mock };

function createMockInvoiceRepository(): MockedInvoiceRepository {
  return { findReminderCandidates: jest.fn().mockResolvedValue([]) };
}
function createMockInvoiceReminderRepository(): MockedInvoiceReminderRepository {
  return { findExisting: jest.fn().mockResolvedValue([]), record: jest.fn().mockResolvedValue({}) };
}
function createMockBusinessAssignmentRepository(assignments: Array<{ userId: string }> = []): MockedBusinessAssignmentRepository {
  return { findByBusiness: jest.fn().mockResolvedValue(assignments) };
}
function createMockAuditLogRecorder(): MockedAuditLogRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}
function createMockNotificationDispatchService(): MockedNotificationDispatchService {
  return { send: jest.fn().mockResolvedValue([]) };
}

function createMockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'invoice-1',
    tenantId: TENANT_A,
    invoiceNumber: 'INV-001',
    clientId: null,
    businessId: BUSINESS_ID,
    amount: new Prisma.Decimal(1000),
    tax: new Prisma.Decimal(180),
    issuedDate: null,
    dueDate: TODAY,
    status: InvoiceStatus.SENT,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  } as Invoice;
}

function createService(
  invoiceRepository: MockedInvoiceRepository = createMockInvoiceRepository(),
  invoiceReminderRepository: MockedInvoiceReminderRepository = createMockInvoiceReminderRepository(),
  businessAssignmentRepository: MockedBusinessAssignmentRepository = createMockBusinessAssignmentRepository([{ userId: USER_A }]),
  auditLogRecorder: MockedAuditLogRecorder = createMockAuditLogRecorder(),
  notificationDispatchService: MockedNotificationDispatchService = createMockNotificationDispatchService(),
): BillingReminderService {
  return new BillingReminderService(
    invoiceRepository as unknown as InvoiceRepository,
    invoiceReminderRepository as unknown as InvoiceReminderRepository,
    businessAssignmentRepository as unknown as BusinessAssignmentRepository,
    auditLogRecorder as unknown as AuditLogRecorder,
    notificationDispatchService as unknown as NotificationDispatchService,
  );
}

describe('BillingReminderService', () => {
  let loggerInfoSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined as never);
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as never);
    loggerDebugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    loggerInfoSpy.mockRestore();
    loggerWarnSpy.mockRestore();
    loggerDebugSpy.mockRestore();
  });

  describe('processReminders — date range computation', () => {
    it('queries findReminderCandidates once per cadence type with the correct [gte, lt) ranges', async () => {
      const invoiceRepo = createMockInvoiceRepository();
      const service = createService(invoiceRepo);

      await service.processReminders(NOW);

      expect(invoiceRepo.findReminderCandidates).toHaveBeenCalledTimes(4);
      expect(invoiceRepo.findReminderCandidates).toHaveBeenCalledWith({ gte: TOMORROW, lt: DAY_AFTER_TOMORROW }, { ignoreTenant: true });
      expect(invoiceRepo.findReminderCandidates).toHaveBeenCalledWith({ gte: IN_7_DAYS, lt: IN_8_DAYS }, { ignoreTenant: true });
      expect(invoiceRepo.findReminderCandidates).toHaveBeenCalledWith({ gte: IN_30_DAYS, lt: IN_31_DAYS }, { ignoreTenant: true });
      expect(invoiceRepo.findReminderCandidates).toHaveBeenCalledWith({ lt: TODAY }, { ignoreTenant: true });
    });

    it('returns a zero summary for every type when there are no candidates', async () => {
      const service = createService();
      const summary = await service.processReminders(NOW);

      expect(summary).toEqual({
        [ReminderCadenceType.DUE_TOMORROW]: 0,
        [ReminderCadenceType.DUE_IN_7_DAYS]: 0,
        [ReminderCadenceType.DUE_IN_30_DAYS]: 0,
        [ReminderCadenceType.OVERDUE]: 0,
      });
    });
  });

  describe('processReminders — recipient fan-out (every business assignee, not a single assignee)', () => {
    it('sends one reminder per assigned staff member for a due-tomorrow invoice', async () => {
      const invoice = createMockInvoice({ dueDate: TOMORROW });
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TOMORROW.getTime() ? [invoice] : []),
      );
      const assignmentRepo = createMockBusinessAssignmentRepository([{ userId: USER_A }, { userId: USER_B }]);
      const notificationService = createMockNotificationDispatchService();
      const reminderRepo = createMockInvoiceReminderRepository();

      const service = createService(invoiceRepo, reminderRepo, assignmentRepo, undefined, notificationService);
      const summary = await service.processReminders(NOW);

      expect(assignmentRepo.findByBusiness).toHaveBeenCalledWith(BUSINESS_ID, { ignoreTenant: true });
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_A, userId: USER_A, title: 'Payment due tomorrow', channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL] }),
      );
      expect(notificationService.send).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_B }));
      expect(reminderRepo.record).toHaveBeenCalledWith(
        { invoiceId: invoice.id, userId: USER_A, type: ReminderCadenceType.DUE_TOMORROW, bucket: '' },
        { tenantId: TENANT_A },
      );
      expect(summary[ReminderCadenceType.DUE_TOMORROW]).toBe(2);
    });

    it('writes a system-actor BILLING_REMINDER_SENT audit entry including the invoice number', async () => {
      const invoice = createMockInvoice({ dueDate: TOMORROW, invoiceNumber: 'INV-042' });
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TOMORROW.getTime() ? [invoice] : []),
      );
      const auditRecorder = createMockAuditLogRecorder();

      const service = createService(invoiceRepo, undefined, undefined, auditRecorder);
      await service.processReminders(NOW);

      expect(auditRecorder.record).toHaveBeenCalledWith({
        tenantId: TENANT_A,
        actorId: AUDIT.SYSTEM_ACTOR_ID,
        actorName: AUDIT.SYSTEM_ACTOR_NAME,
        eventType: AuditEventType.BILLING_REMINDER_SENT,
        description: expect.stringContaining('INV-042'),
        targetType: 'Invoice',
        targetId: invoice.id,
        ipAddress: null,
      });
    });
  });

  describe('processReminders — OVERDUE uses the ISO-week bucket, not the empty one-shot bucket', () => {
    it('records the OVERDUE reminder with a non-empty bucket', async () => {
      const invoice = createMockInvoice({ dueDate: new Date('2026-06-10T00:00:00.000Z') });
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findReminderCandidates.mockImplementation((range: { lt?: Date; gte?: Date }) =>
        Promise.resolve(range.lt?.getTime() === TODAY.getTime() && range.gte === undefined ? [invoice] : []),
      );
      const reminderRepo = createMockInvoiceReminderRepository();

      const service = createService(invoiceRepo, reminderRepo);
      await service.processReminders(NOW);

      expect(reminderRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: ReminderCadenceType.OVERDUE, bucket: expect.stringMatching(/^\d{4}-W\d{2}$/) }),
        { tenantId: TENANT_A },
      );
    });
  });

  describe('processReminders — idempotency and failure isolation', () => {
    it('skips an (invoiceId, userId) pair that already has a recorded reminder for this type/bucket', async () => {
      const invoice = createMockInvoice({ dueDate: TOMORROW });
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TOMORROW.getTime() ? [invoice] : []),
      );
      const reminderRepo = createMockInvoiceReminderRepository();
      reminderRepo.findExisting.mockResolvedValue([{ invoiceId: invoice.id, userId: USER_A }]);
      const notificationService = createMockNotificationDispatchService();

      const service = createService(invoiceRepo, reminderRepo, undefined, undefined, notificationService);
      const summary = await service.processReminders(NOW);

      expect(notificationService.send).not.toHaveBeenCalled();
      expect(summary[ReminderCadenceType.DUE_TOMORROW]).toBe(0);
    });

    it('continues to the next invoice after one fails to dispatch', async () => {
      const failingInvoice = createMockInvoice({ id: 'invoice-fail', dueDate: TOMORROW });
      const okInvoice = createMockInvoice({ id: 'invoice-ok', dueDate: TOMORROW, businessId: 'business-other' });
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TOMORROW.getTime() ? [failingInvoice, okInvoice] : []),
      );
      const assignmentRepo = {
        findByBusiness: jest.fn().mockImplementation((businessId: string) =>
          Promise.resolve(businessId === BUSINESS_ID ? [{ userId: USER_A }] : [{ userId: USER_B }]),
        ),
      };
      const notificationService = createMockNotificationDispatchService();
      notificationService.send.mockImplementation((input: { userId: string }) =>
        input.userId === USER_A ? Promise.reject(new Error('SMTP down')) : Promise.resolve([]),
      );
      const reminderRepo = createMockInvoiceReminderRepository();

      const service = createService(invoiceRepo, reminderRepo, assignmentRepo, undefined, notificationService);
      const summary = await service.processReminders(NOW);

      expect(reminderRepo.record).toHaveBeenCalledTimes(1);
      expect(reminderRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: 'invoice-ok', userId: USER_B }),
        { tenantId: TENANT_A },
      );
      expect(summary[ReminderCadenceType.DUE_TOMORROW]).toBe(1);
      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('treats a P2002 from record() as an already-sent duplicate — no audit, debug log not warn', async () => {
      const invoice = createMockInvoice({ dueDate: TOMORROW });
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TOMORROW.getTime() ? [invoice] : []),
      );
      const reminderRepo = createMockInvoiceReminderRepository();
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '7.8.0' });
      reminderRepo.record.mockRejectedValue(p2002);
      const auditRecorder = createMockAuditLogRecorder();

      const service = createService(invoiceRepo, reminderRepo, undefined, auditRecorder);
      const summary = await service.processReminders(NOW);

      expect(auditRecorder.record).not.toHaveBeenCalled();
      expect(summary[ReminderCadenceType.DUE_TOMORROW]).toBe(0);
      expect(loggerDebugSpy).toHaveBeenCalled();
      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });
  });
});
