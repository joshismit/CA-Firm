import { Request } from 'express';
import { AuditEventType } from '@prisma/client';

/** See the identical comment in tests/unit/modules/documents/document.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { UPLOAD } from '@shared/constants';
import { TenantStorageSettingsService } from '@modules/tenant/service/tenant-storage-settings.service';
import { TenantStorageSettingsRepository } from '@modules/tenant/repository/tenant-storage-settings.repository';
import { StorageQuotaService } from '@modules/documents';
import { AuditLogRecorder } from '@modules/audit';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TenantStorageSettingsService — Unit Tests (PRD §7.4, Firm Settings → Storage)
 * ─────────────────────────────────────────────────────────────────────────────
 * Repository/StorageQuotaService/AuditLogRecorder are fully mocked, injected
 * via constructor DI — mirrors `tests/unit/modules/tenant/tenant-branding.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

type MockedRepository = { [K in 'findByTenantId' | 'upsertDefaultBusinessQuota']: jest.Mock };
type MockedStorageQuotaService = { getEffectiveMaxUploadBytes: jest.Mock };
type MockedAuditLogRecorder = { record: jest.Mock };

function createMockRepository(): MockedRepository {
  return { findByTenantId: jest.fn().mockResolvedValue(null), upsertDefaultBusinessQuota: jest.fn().mockResolvedValue(undefined) };
}
function createMockStorageQuotaService(): MockedStorageQuotaService {
  return { getEffectiveMaxUploadBytes: jest.fn().mockResolvedValue(UPLOAD.DEFAULT_MAX_FILE_SIZE_BYTES) };
}
function createMockAuditLogRecorder(): MockedAuditLogRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}
function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
    ip: '127.0.0.1',
  } as unknown as Request;
}

function createService(
  repo: MockedRepository = createMockRepository(),
  storageQuotaService: MockedStorageQuotaService = createMockStorageQuotaService(),
  auditLogRecorder: MockedAuditLogRecorder = createMockAuditLogRecorder(),
): TenantStorageSettingsService {
  return new TenantStorageSettingsService(
    createFakeRequest(),
    repo as unknown as TenantStorageSettingsRepository,
    storageQuotaService as unknown as StorageQuotaService,
    auditLogRecorder as unknown as AuditLogRecorder,
  );
}

describe('TenantStorageSettingsService', () => {
  describe('getStorageSettings', () => {
    it('reports the effective max upload size in MB, converted from StorageQuotaService bytes', async () => {
      const storageQuotaService = createMockStorageQuotaService();
      storageQuotaService.getEffectiveMaxUploadBytes.mockResolvedValue(250 * 1024 * 1024);

      const result = await createService(undefined, storageQuotaService).getStorageSettings();

      expect(storageQuotaService.getEffectiveMaxUploadBytes).toHaveBeenCalledWith(TENANT_ID);
      expect(result.maxUploadSizeMb).toBe(250);
    });

    it('returns null defaultBusinessStorageQuotaMb when TenantSettings has no override', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue({ defaultBusinessStorageQuotaMb: null });

      const result = await createService(repo).getStorageSettings();

      expect(result.defaultBusinessStorageQuotaMb).toBeNull();
    });

    it('returns the configured defaultBusinessStorageQuotaMb when set', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue({ defaultBusinessStorageQuotaMb: 750 });

      const result = await createService(repo).getStorageSettings();

      expect(result.defaultBusinessStorageQuotaMb).toBe(750);
    });
  });

  describe('updateStorageSettings', () => {
    it('upserts the new default and returns the refreshed settings', async () => {
      const repo = createMockRepository();
      repo.findByTenantId
        .mockResolvedValueOnce({ defaultBusinessStorageQuotaMb: null }) // "before" read
        .mockResolvedValueOnce({ defaultBusinessStorageQuotaMb: 750 }); // getStorageSettings() re-read

      const result = await createService(repo).updateStorageSettings({ defaultBusinessStorageQuotaMb: 750 });

      expect(repo.upsertDefaultBusinessQuota).toHaveBeenCalledWith(TENANT_ID, 750);
      expect(result.defaultBusinessStorageQuotaMb).toBe(750);
    });

    it('audit-logs a SETTINGS_UPDATE entry when the value actually changes', async () => {
      const repo = createMockRepository();
      repo.findByTenantId
        .mockResolvedValueOnce({ defaultBusinessStorageQuotaMb: null })
        .mockResolvedValueOnce({ defaultBusinessStorageQuotaMb: 750 });
      const auditLogRecorder = createMockAuditLogRecorder();

      await createService(repo, undefined, auditLogRecorder).updateStorageSettings({ defaultBusinessStorageQuotaMb: 750 });

      expect(auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          actorId: USER_ID,
          eventType: AuditEventType.SETTINGS_UPDATE,
          targetType: 'TenantSettings',
        }),
      );
    });

    it('does not audit-log a no-op re-set to the same value', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue({ defaultBusinessStorageQuotaMb: 750 });
      const auditLogRecorder = createMockAuditLogRecorder();

      await createService(repo, undefined, auditLogRecorder).updateStorageSettings({ defaultBusinessStorageQuotaMb: 750 });

      expect(auditLogRecorder.record).not.toHaveBeenCalled();
    });

    it('leaves the stored value untouched when defaultBusinessStorageQuotaMb is absent from the payload', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue({ defaultBusinessStorageQuotaMb: 750 });

      await createService(repo).updateStorageSettings({});

      expect(repo.upsertDefaultBusinessQuota).not.toHaveBeenCalled();
    });

    it('can reset to the global default by passing null', async () => {
      const repo = createMockRepository();
      repo.findByTenantId
        .mockResolvedValueOnce({ defaultBusinessStorageQuotaMb: 750 })
        .mockResolvedValueOnce({ defaultBusinessStorageQuotaMb: null });

      const result = await createService(repo).updateStorageSettings({ defaultBusinessStorageQuotaMb: null });

      expect(repo.upsertDefaultBusinessQuota).toHaveBeenCalledWith(TENANT_ID, null);
      expect(result.defaultBusinessStorageQuotaMb).toBeNull();
    });
  });
});
