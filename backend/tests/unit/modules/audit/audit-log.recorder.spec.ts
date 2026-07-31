import { AuditEventType } from '@prisma/client';

/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: { user: { findFirst: jest.fn() } } }));

import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { AuditLogRecorder } from '@modules/audit/service/audit-log.recorder';
import { AuditLogRepository } from '@modules/audit/repository/audit-log.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AuditLogRecorder — Unit Tests (write side)
 * ─────────────────────────────────────────────────────────────────────────────
 * The repository is fully mocked — exercises only `AuditLogRecorder`'s own
 * logic: resolving `actorName` off the `User` row, the "Unknown" fallback
 * when no such user exists in this tenant, and that a repository failure is
 * swallowed (logged, never thrown) rather than propagated to the caller —
 * see the class's header comment for why.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const ACTOR_ID = 'user-22222222-2222-2222-2222-222222222222';

const findFirstMock = prisma.user.findFirst as jest.Mock;

function createMockRepository(): { record: jest.Mock } {
  return { record: jest.fn().mockResolvedValue({}) };
}

function createRecorder(repository: { record: jest.Mock }): AuditLogRecorder {
  return new AuditLogRecorder(repository as unknown as AuditLogRepository);
}

describe('AuditLogRecorder', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it('resolves actorName from the User row and writes the entry', async () => {
    findFirstMock.mockResolvedValue({ firstName: 'Priya', lastName: 'Sharma' });
    const repo = createMockRepository();

    const recorder = createRecorder(repo);
    await recorder.record({
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      eventType: AuditEventType.ROLE_CHANGE,
      description: 'Assigned role "Manager"',
      targetType: 'User',
      targetId: 'target-user-id',
      ipAddress: '10.0.0.1',
    });

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: ACTOR_ID, tenantId: TENANT_ID },
      select: { firstName: true, lastName: true },
    });
    expect(repo.record).toHaveBeenCalledWith(
      {
        eventType: AuditEventType.ROLE_CHANGE,
        actorId: ACTOR_ID,
        actorName: 'Priya Sharma',
        targetType: 'User',
        targetId: 'target-user-id',
        description: 'Assigned role "Manager"',
        ipAddress: '10.0.0.1',
      },
      { tenantId: TENANT_ID },
    );
  });

  it('falls back to "Unknown" when no matching User row exists in this tenant', async () => {
    findFirstMock.mockResolvedValue(null);
    const repo = createMockRepository();

    const recorder = createRecorder(repo);
    await recorder.record({
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      eventType: AuditEventType.LOGIN,
      description: 'Logged in',
    });

    expect(repo.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorName: 'Unknown', targetType: null, targetId: null, ipAddress: null }),
      { tenantId: TENANT_ID },
    );
  });

  it('swallows a repository failure — never throws, only logs a warning', async () => {
    findFirstMock.mockResolvedValue({ firstName: 'Priya', lastName: 'Sharma' });
    const repo = createMockRepository();
    repo.record.mockRejectedValue(new Error('DB unavailable'));
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as never);

    const recorder = createRecorder(repo);
    await expect(
      recorder.record({
        tenantId: TENANT_ID,
        actorId: ACTOR_ID,
        eventType: AuditEventType.TASK_UPDATE,
        description: 'Changed task status',
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
