/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { DocumentRequest, DocumentCategory, DocumentRequestStatus, ReminderCadenceType, AuditEventType, NotificationChannel } from '@prisma/client';
import { logger } from '@config/logger';
import { AUDIT } from '@shared/constants';
import { DocumentReminderService } from '@modules/documents/service/document-reminder.service';
import { DocumentRequestRepository } from '@modules/documents/repository/document-request.repository';
import { DocumentRequestReminderRepository } from '@modules/documents/repository/document-request-reminder.repository';
import { AuditLogRecorder } from '@modules/audit/service/audit-log.recorder';
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { BusinessAssignmentRepository } from '@modules/business/repository/business-assignment.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DocumentReminderService — Unit Tests (abbreviated)
 * ─────────────────────────────────────────────────────────────────────────────
 * See `ComplianceReminderService.spec.ts`'s identical header comment for why
 * this is abbreviated relative to `BillingReminderService`'s full suite.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_A = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_A = 'user-33333333-3333-3333-3333-333333333333';
const BUSINESS_ID = 'business-55555555-5555-5555-5555-555555555555';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const TODAY = new Date('2026-06-15T00:00:00.000Z');

function createMockRequest(overrides: Partial<DocumentRequest> = {}): DocumentRequest {
  return {
    id: 'request-1',
    tenantId: TENANT_A,
    businessId: BUSINESS_ID,
    category: DocumentCategory.GST,
    description: null,
    dueDate: new Date('2026-06-10T00:00:00.000Z'),
    status: DocumentRequestStatus.PENDING,
    requestedById: USER_A,
    fulfilledDocumentId: null,
    fulfilledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

describe('DocumentReminderService', () => {
  let loggerInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    loggerInfoSpy.mockRestore();
  });

  it('dispatches an OVERDUE reminder (with an ISO-week bucket) to every business assignee and writes DOCUMENT_REMINDER_SENT', async () => {
    const documentRequest = createMockRequest();
    const requestRepo = {
      findReminderCandidates: jest.fn().mockImplementation((range: { lt?: Date; gte?: Date }) =>
        Promise.resolve(range.lt?.getTime() === TODAY.getTime() && range.gte === undefined ? [documentRequest] : []),
      ),
    };
    const reminderRepo = { findExisting: jest.fn().mockResolvedValue([]), record: jest.fn().mockResolvedValue({}) };
    const assignmentRepo = { findByBusiness: jest.fn().mockResolvedValue([{ userId: USER_A }]) };
    const auditRecorder = { record: jest.fn().mockResolvedValue(undefined) };
    const notificationService = { send: jest.fn().mockResolvedValue([]) };

    const service = new DocumentReminderService(
      requestRepo as unknown as DocumentRequestRepository,
      reminderRepo as unknown as DocumentRequestReminderRepository,
      assignmentRepo as unknown as BusinessAssignmentRepository,
      auditRecorder as unknown as AuditLogRecorder,
      notificationService as unknown as NotificationDispatchService,
    );
    const summary = await service.processReminders(NOW);

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A, userId: USER_A, title: 'Document request overdue' }),
    );
    expect(reminderRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ documentRequestId: documentRequest.id, userId: USER_A, type: ReminderCadenceType.OVERDUE }),
      { tenantId: TENANT_A },
    );
    const recordedBucket = reminderRepo.record.mock.calls[0][0].bucket as string;
    expect(recordedBucket).toMatch(/^\d{4}-W\d{2}$/);
    expect(auditRecorder.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: AuditEventType.DOCUMENT_REMINDER_SENT }));
    expect(summary[ReminderCadenceType.OVERDUE]).toBe(1);
  });

  it('never sends when there are no PENDING candidates in any bucket', async () => {
    const requestRepo = { findReminderCandidates: jest.fn().mockResolvedValue([]) };
    const notificationService = { send: jest.fn() };

    const service = new DocumentReminderService(
      requestRepo as unknown as DocumentRequestRepository,
      undefined,
      undefined,
      undefined,
      notificationService as unknown as NotificationDispatchService,
    );
    const summary = await service.processReminders(NOW);

    expect(notificationService.send).not.toHaveBeenCalled();
    expect(Object.values(summary).every((count) => count === 0)).toBe(true);
  });
});
