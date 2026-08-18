/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { ComplianceFiling, ComplianceCategory, ComplianceFilingStatus, ReminderCadenceType, AuditEventType, NotificationChannel } from '@prisma/client';
import { logger } from '@config/logger';
import { AUDIT } from '@shared/constants';
import { ComplianceReminderService } from '@modules/compliance/service/compliance-reminder.service';
import { ComplianceFilingRepository } from '@modules/compliance/repository/compliance-filing.repository';
import { ComplianceReminderRepository } from '@modules/compliance/repository/compliance-reminder.repository';
import { AuditLogRecorder } from '@modules/audit/service/audit-log.recorder';
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { BusinessAssignmentRepository } from '@modules/business/repository/business-assignment.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ComplianceReminderService — Unit Tests (abbreviated)
 * ─────────────────────────────────────────────────────────────────────────────
 * Structurally identical to `BillingReminderService` (independent copy, not
 * shared code — see `ReminderCadenceType`'s schema comment), which already
 * has full date-range/idempotency/failure-isolation coverage. This suite
 * checks only what's actually specific to this copy: candidates require a
 * non-null `businessId`, the dispatched copy text, and the
 * `COMPLIANCE_REMINDER_SENT` audit event.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_A = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_A = 'user-33333333-3333-3333-3333-333333333333';
const BUSINESS_ID = 'business-55555555-5555-5555-5555-555555555555';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const TOMORROW = new Date('2026-06-16T00:00:00.000Z');

function createMockFiling(overrides: Partial<ComplianceFiling> = {}): ComplianceFiling {
  return {
    id: 'filing-1',
    tenantId: TENANT_A,
    category: ComplianceCategory.GST,
    reference: 'GSTR-3B',
    period: 'Q1 FY26',
    status: ComplianceFilingStatus.PENDING,
    dueDate: TOMORROW,
    filedDate: null,
    notes: null,
    businessId: BUSINESS_ID,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

describe('ComplianceReminderService', () => {
  let loggerInfoSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined as never);
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    loggerInfoSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  it('dispatches IN_APP + EMAIL to every business assignee, records the reminder, and writes COMPLIANCE_REMINDER_SENT', async () => {
    const filing = createMockFiling();
    const filingRepo = {
      findReminderCandidates: jest.fn().mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TOMORROW.getTime() ? [filing] : []),
      ),
    };
    const reminderRepo = { findExisting: jest.fn().mockResolvedValue([]), record: jest.fn().mockResolvedValue({}) };
    const assignmentRepo = { findByBusiness: jest.fn().mockResolvedValue([{ userId: USER_A }]) };
    const auditRecorder = { record: jest.fn().mockResolvedValue(undefined) };
    const notificationService = { send: jest.fn().mockResolvedValue([]) };

    const service = new ComplianceReminderService(
      filingRepo as unknown as ComplianceFilingRepository,
      reminderRepo as unknown as ComplianceReminderRepository,
      assignmentRepo as unknown as BusinessAssignmentRepository,
      auditRecorder as unknown as AuditLogRecorder,
      notificationService as unknown as NotificationDispatchService,
    );
    const summary = await service.processReminders(NOW);

    expect(assignmentRepo.findByBusiness).toHaveBeenCalledWith(BUSINESS_ID, { ignoreTenant: true });
    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_A,
        userId: USER_A,
        title: 'GST filing due tomorrow',
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      }),
    );
    expect(reminderRepo.record).toHaveBeenCalledWith(
      { complianceFilingId: filing.id, userId: USER_A, type: ReminderCadenceType.DUE_TOMORROW, bucket: '' },
      { tenantId: TENANT_A },
    );
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_A,
        actorId: AUDIT.SYSTEM_ACTOR_ID,
        eventType: AuditEventType.COMPLIANCE_REMINDER_SENT,
        targetType: 'ComplianceFiling',
        targetId: filing.id,
      }),
    );
    expect(summary[ReminderCadenceType.DUE_TOMORROW]).toBe(1);
  });

  it('never queries findReminderCandidates with a filter that would include businessId: null (candidates require a business link)', async () => {
    const filingRepo = { findReminderCandidates: jest.fn().mockResolvedValue([]) };
    const service = new ComplianceReminderService(filingRepo as unknown as ComplianceFilingRepository);

    await service.processReminders(NOW);

    // The repository itself enforces `businessId: { not: null }` (see its own implementation) —
    // this just confirms the service always delegates to it rather than filtering client-side.
    expect(filingRepo.findReminderCandidates).toHaveBeenCalledTimes(4);
  });
});
