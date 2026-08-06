import { AuditEventType, AuditLog } from '@prisma/client';
import { AuditTimelineReader } from '@modules/audit/service/audit-timeline.reader';
import { AuditLogRepository } from '@modules/audit/repository/audit-log.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AuditTimelineReader — Unit Tests (read side, PRD §8.11)
 * ─────────────────────────────────────────────────────────────────────────────
 * The repository is fully mocked — exercises only `AuditTimelineReader`'s own
 * logic: that it scopes the search to `targetType`/`targetId`/`tenantId` and
 * maps the raw `AuditLog` rows through `AuditMapper` before returning them.
 * Mirrors `tests/unit/modules/audit/audit-log.recorder.spec.ts` (the write
 * side's equivalent test).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';

function createMockRepository(): { search: jest.Mock } {
  return { search: jest.fn() };
}

function createReader(repository: { search: jest.Mock }): AuditTimelineReader {
  return new AuditTimelineReader(repository as unknown as AuditLogRepository);
}

function buildAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'audit-1',
    tenantId: TENANT_ID,
    eventType: AuditEventType.LEAD_CREATED,
    actorId: 'user-1',
    actorName: 'Priya Sharma',
    targetType: 'Lead',
    targetId: 'lead-1',
    description: 'Created lead "Acme Corp — GST Advisory"',
    ipAddress: '10.0.0.1',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('AuditTimelineReader', () => {
  describe('getTimeline', () => {
    it('scopes the repository search to targetType/targetId, with tenantId only in options (not filters)', async () => {
      const repo = createMockRepository();
      const paginated = {
        data: [buildAuditLog()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const reader = createReader(repo);
      await reader.getTimeline('Lead', 'lead-1', TENANT_ID, { page: 1, limit: 20 });

      expect(repo.search).toHaveBeenCalledWith(
        { targetType: 'Lead', targetId: 'lead-1' },
        { page: 1, limit: 20 },
        { tenantId: TENANT_ID },
      );
    });

    it('maps every raw AuditLog row through AuditMapper before returning', async () => {
      const repo = createMockRepository();
      const log = buildAuditLog();
      const meta = { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false };
      repo.search.mockResolvedValue({ data: [log], meta });

      const reader = createReader(repo);
      const result = await reader.getTimeline('Lead', 'lead-1', TENANT_ID, { page: 1, limit: 20 });

      expect(result.data).toEqual([
        {
          id: log.id,
          eventType: log.eventType,
          actorId: log.actorId,
          actorName: log.actorName,
          targetType: log.targetType,
          targetId: log.targetId,
          description: log.description,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt.toISOString(),
        },
      ]);
      expect(result.data[0]).not.toHaveProperty('tenantId');
      expect(result.meta).toBe(meta);
    });

    it('preserves the pagination meta returned by the repository', async () => {
      const repo = createMockRepository();
      const meta = { page: 2, limit: 10, total: 25, totalPages: 3, hasNextPage: true, hasPrevPage: true };
      repo.search.mockResolvedValue({ data: [], meta });

      const reader = createReader(repo);
      const result = await reader.getTimeline('Business', 'business-1', TENANT_ID, { page: 2, limit: 10 });

      expect(result.meta).toBe(meta);
    });
  });
});
