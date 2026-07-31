import { TenantBranding, TenantDomain, DomainSslStatus } from '@prisma/client';

/** See the identical comment in tests/unit/modules/documents/document.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { PublicBrandingService } from '@modules/tenant/service/public-branding.service';
import { TenantDomainRepository } from '@modules/tenant/repository/tenant-domain.repository';
import { TenantBrandingRepository } from '@modules/tenant/repository/tenant-branding.repository';
import { S3StorageService } from '@storage/s3-storage.service';

type MockedDomainRepo = { [K in 'findByHostname']: jest.Mock };
type MockedBrandingRepo = { [K in 'findByTenantId']: jest.Mock };
type MockedStorage = { [K in 'getDownloadUrl']: jest.Mock };

function createDomain(overrides: Partial<TenantDomain> = {}): TenantDomain {
  return {
    id: 'domain-id',
    tenantId: 'tenant-1',
    domain: 'acme.localhost',
    subdomain: 'acme',
    verificationToken: 'token',
    isVerified: true,
    verifiedAt: new Date(),
    sslStatus: DomainSslStatus.PROVISIONED,
    sslExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
function createBranding(overrides: Partial<TenantBranding> = {}): TenantBranding {
  return {
    id: 'branding-id',
    tenantId: 'tenant-1',
    firmName: 'Acme & Co',
    logoStorageKey: null,
    logoDarkStorageKey: null,
    faviconStorageKey: null,
    loginBgStorageKey: null,
    primaryColor: '#ff0000',
    secondaryColor: null,
    accentColor: '#00ff00',
    backgroundColor: null,
    emailHeaderColor: null,
    fontFamily: 'Inter',
    customCss: null,
    emailFooterText: null,
    footerText: null,
    supportEmail: null,
    supportPhone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('PublicBrandingService', () => {
  it('returns an all-null response when no tenant claims this hostname', async () => {
    const domainRepo: MockedDomainRepo = { findByHostname: jest.fn().mockResolvedValue(null) };
    const brandingRepo: MockedBrandingRepo = { findByTenantId: jest.fn() };
    const storage: MockedStorage = { getDownloadUrl: jest.fn() };

    const service = new PublicBrandingService(
      domainRepo as unknown as TenantDomainRepository,
      brandingRepo as unknown as TenantBrandingRepository,
      storage as unknown as S3StorageService,
    );

    const result = await service.resolveByHostname('app.example.test');

    expect(result).toEqual({ firmName: null, logoUrl: null, faviconUrl: null, primaryColor: null, accentColor: null });
    expect(brandingRepo.findByTenantId).not.toHaveBeenCalled();
  });

  it('resolves the branding for the tenant owning this hostname', async () => {
    const domainRepo: MockedDomainRepo = { findByHostname: jest.fn().mockResolvedValue(createDomain({ tenantId: 'tenant-42' })) };
    const brandingRepo: MockedBrandingRepo = { findByTenantId: jest.fn().mockResolvedValue(createBranding({ tenantId: 'tenant-42', logoStorageKey: 'logo-key' })) };
    const storage: MockedStorage = { getDownloadUrl: jest.fn().mockResolvedValue('https://signed.example.test/logo.png') };

    const service = new PublicBrandingService(
      domainRepo as unknown as TenantDomainRepository,
      brandingRepo as unknown as TenantBrandingRepository,
      storage as unknown as S3StorageService,
    );

    const result = await service.resolveByHostname('acme.localhost');

    expect(brandingRepo.findByTenantId).toHaveBeenCalledWith('tenant-42');
    expect(result).toEqual({
      firmName: 'Acme & Co',
      logoUrl: 'https://signed.example.test/logo.png',
      faviconUrl: null,
      primaryColor: '#ff0000',
      accentColor: '#00ff00',
    });
  });

  it('returns all-null branding fields when a domain matches but branding was never configured', async () => {
    const domainRepo: MockedDomainRepo = { findByHostname: jest.fn().mockResolvedValue(createDomain()) };
    const brandingRepo: MockedBrandingRepo = { findByTenantId: jest.fn().mockResolvedValue(null) };
    const storage: MockedStorage = { getDownloadUrl: jest.fn() };

    const service = new PublicBrandingService(
      domainRepo as unknown as TenantDomainRepository,
      brandingRepo as unknown as TenantBrandingRepository,
      storage as unknown as S3StorageService,
    );

    const result = await service.resolveByHostname('acme.localhost');

    expect(result).toEqual({ firmName: null, logoUrl: null, faviconUrl: null, primaryColor: null, accentColor: null });
    expect(storage.getDownloadUrl).not.toHaveBeenCalled();
  });
});
