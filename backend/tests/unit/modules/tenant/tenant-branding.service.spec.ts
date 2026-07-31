import { Request } from 'express';
import { TenantBranding } from '@prisma/client';

/** See the identical comment in tests/unit/modules/documents/document.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { BadRequestError } from '@shared/errors';
import { UPLOAD } from '@shared/constants';
import { TenantBrandingService } from '@modules/tenant/service/tenant-branding.service';
import { TenantBrandingRepository } from '@modules/tenant/repository/tenant-branding.repository';
import { S3StorageService } from '@storage/s3-storage.service';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TenantBrandingService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Repository and storage are fully mocked, injected via constructor DI —
 * mirrors `tests/unit/modules/documents/document.service.spec.ts` exactly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

type MockedRepository = { [K in 'findByTenantId' | 'upsert']: jest.Mock };
type MockedStorageService = { [K in 'upload' | 'getDownloadUrl']: jest.Mock };

function createMockRepository(): MockedRepository {
  return { findByTenantId: jest.fn(), upsert: jest.fn() };
}
function createMockStorageService(): MockedStorageService {
  return { upload: jest.fn(), getDownloadUrl: jest.fn() };
}
function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}
function createMockBranding(overrides: Partial<TenantBranding> = {}): TenantBranding {
  return {
    id: 'branding-id',
    tenantId: TENANT_ID,
    firmName: 'Acme & Co',
    logoStorageKey: null,
    logoDarkStorageKey: null,
    faviconStorageKey: null,
    loginBgStorageKey: null,
    primaryColor: '#1a73e8',
    secondaryColor: null,
    accentColor: null,
    backgroundColor: null,
    emailHeaderColor: null,
    fontFamily: 'Inter',
    customCss: null,
    emailFooterText: null,
    footerText: null,
    supportEmail: null,
    supportPhone: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
function createService(repo: MockedRepository, storage: MockedStorageService): TenantBrandingService {
  return new TenantBrandingService(
    createFakeRequest(),
    repo as unknown as TenantBrandingRepository,
    storage as unknown as S3StorageService,
  );
}

describe('TenantBrandingService', () => {
  describe('getBranding', () => {
    it('returns an all-null response when no branding row exists yet', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);
      const storage = createMockStorageService();

      const result = await createService(repo, storage).getBranding();

      expect(result).toMatchObject({ firmName: null, logoUrl: null, primaryColor: null, updatedAt: null });
      expect(storage.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('resolves a presigned URL only for image slots that are actually set', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(createMockBranding({ logoStorageKey: 'tenants/x/branding/logo-abc.png' }));
      const storage = createMockStorageService();
      storage.getDownloadUrl.mockResolvedValue('https://signed.example.test/logo-abc.png');

      const result = await createService(repo, storage).getBranding();

      expect(storage.getDownloadUrl).toHaveBeenCalledTimes(1);
      expect(storage.getDownloadUrl).toHaveBeenCalledWith('tenants/x/branding/logo-abc.png');
      expect(result.logoUrl).toBe('https://signed.example.test/logo-abc.png');
      expect(result.logoDarkUrl).toBeNull();
      expect(result.firmName).toBe('Acme & Co');
    });
  });

  describe('updateBranding', () => {
    it('upserts scoped to the caller tenant and returns the refreshed branding', async () => {
      const repo = createMockRepository();
      repo.upsert.mockResolvedValue(undefined);
      repo.findByTenantId.mockResolvedValue(createMockBranding({ firmName: 'New Name' }));
      const storage = createMockStorageService();

      const result = await createService(repo, storage).updateBranding({ firmName: 'New Name' });

      expect(repo.upsert).toHaveBeenCalledWith(TENANT_ID, { firmName: 'New Name' });
      expect(result.firmName).toBe('New Name');
    });
  });

  describe('uploadAsset', () => {
    const fakeFile = { originalname: 'logo.png', mimetype: 'image/png', size: 1024, buffer: Buffer.from('x') } as Express.Multer.File;

    it('throws BadRequestError when no file is provided', async () => {
      const service = createService(createMockRepository(), createMockStorageService());
      await expect(service.uploadAsset('logo', undefined)).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError for an unsupported mime type', async () => {
      const service = createService(createMockRepository(), createMockStorageService());
      await expect(service.uploadAsset('logo', { ...fakeFile, mimetype: 'application/exe' })).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError when the file exceeds the max avatar size', async () => {
      const service = createService(createMockRepository(), createMockStorageService());
      await expect(
        service.uploadAsset('logo', { ...fakeFile, size: UPLOAD.MAX_AVATAR_SIZE_BYTES + 1 }),
      ).rejects.toThrow(BadRequestError);
    });

    it('uploads to storage and upserts the correct column for the given slot', async () => {
      const repo = createMockRepository();
      repo.upsert.mockResolvedValue(undefined);
      repo.findByTenantId.mockResolvedValue(createMockBranding());
      const storage = createMockStorageService();
      storage.upload.mockResolvedValue(undefined);

      await createService(repo, storage).uploadAsset('favicon', fakeFile);

      expect(storage.upload).toHaveBeenCalledWith(expect.stringContaining(`tenants/${TENANT_ID}/branding/favicon-`), fakeFile.buffer, 'image/png');
      expect(repo.upsert).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({ faviconStorageKey: expect.stringContaining('favicon-') }));
    });
  });
});
