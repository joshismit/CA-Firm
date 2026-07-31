import { Request } from 'express';
import { TenantDomain, DomainSslStatus } from '@prisma/client';

/** See the identical comment in tests/unit/modules/documents/document.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';
import { TenantDomainService } from '@modules/tenant/service/tenant-domain.service';
import { TenantDomainRepository } from '@modules/tenant/repository/tenant-domain.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TenantDomainService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Repository and DNS resolver are fully mocked, both injected via
 * constructor DI — `resolveTxt` mirrors the exact "inject the network
 * boundary" precedent `EmailProvider`'s `mailTransport` and `AuditLogRecorder`
 * already established, rather than depending on a real, externally-owned
 * domain actually carrying the right TXT record.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

type MockedRepository = {
  [K in 'findByTenantId' | 'findBySubdomainLabel' | 'findByHostname' | 'create' | 'update' | 'deleteByTenantId']: jest.Mock;
};

function createMockRepository(): MockedRepository {
  return {
    findByTenantId: jest.fn(),
    findBySubdomainLabel: jest.fn(),
    findByHostname: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteByTenantId: jest.fn(),
  };
}
function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}
function createMockDomain(overrides: Partial<TenantDomain> = {}): TenantDomain {
  return {
    id: 'domain-id',
    tenantId: TENANT_ID,
    domain: 'acme.localhost',
    subdomain: 'acme',
    verificationToken: 'test-token-123',
    isVerified: true,
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    sslStatus: DomainSslStatus.PROVISIONED,
    sslExpiresAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
function createService(repo: MockedRepository, resolveTxt: jest.Mock = jest.fn()): TenantDomainService {
  return new TenantDomainService(createFakeRequest(), repo as unknown as TenantDomainRepository, resolveTxt);
}

describe('TenantDomainService', () => {
  describe('createDomain', () => {
    it('throws ValidationError when neither subdomain nor customDomain is given', async () => {
      const service = createService(createMockRepository());
      await expect(service.createDomain({})).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when both subdomain and customDomain are given', async () => {
      const service = createService(createMockRepository());
      await expect(service.createDomain({ subdomain: 'acme', customDomain: 'portal.acme.com' })).rejects.toThrow(ValidationError);
    });

    it('throws ConflictError when this tenant already has a domain', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(createMockDomain());
      const service = createService(repo);

      await expect(service.createDomain({ subdomain: 'newname' })).rejects.toThrow(ConflictError);
    });

    it('creates a platform subdomain as already verified with SSL provisioned', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);
      repo.findBySubdomainLabel.mockResolvedValue(null);
      repo.create.mockImplementation((data) =>
        Promise.resolve(createMockDomain({ domain: data.domain, subdomain: data.subdomain, isVerified: data.isVerified, sslStatus: data.sslStatus })),
      );

      const result = await createService(repo).createDomain({ subdomain: 'acme' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'acme.localhost', subdomain: 'acme', isVerified: true, sslStatus: DomainSslStatus.PROVISIONED }),
      );
      expect(result.isVerified).toBe(true);
      expect(result.verification).toBeNull();
    });

    it('throws ConflictError when the subdomain label is already taken', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);
      repo.findBySubdomainLabel.mockResolvedValue(createMockDomain());

      await expect(createService(repo).createDomain({ subdomain: 'acme' })).rejects.toThrow(ConflictError);
    });

    it('creates a custom domain as unverified with SSL pending, and exposes the TXT verification instructions', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);
      repo.findByHostname.mockResolvedValue(null);
      repo.create.mockImplementation((data) =>
        Promise.resolve(
          createMockDomain({
            domain: data.domain,
            subdomain: null,
            isVerified: false,
            sslStatus: data.sslStatus,
            verificationToken: data.verificationToken,
          }),
        ),
      );

      const result = await createService(repo).createDomain({ customDomain: 'portal.acme.com' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'portal.acme.com', isVerified: false, sslStatus: DomainSslStatus.PENDING }),
      );
      expect(result.isVerified).toBe(false);
      expect(result.verification).toEqual({
        recordType: 'TXT',
        recordName: '_cafirm-verify.portal.acme.com',
        recordValue: expect.any(String),
      });
    });

    it('throws ConflictError when the custom domain is already in use', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);
      repo.findByHostname.mockResolvedValue(createMockDomain({ domain: 'portal.acme.com', subdomain: null }));

      await expect(createService(repo).createDomain({ customDomain: 'portal.acme.com' })).rejects.toThrow(ConflictError);
    });
  });

  describe('verifyDomain', () => {
    it('throws NotFoundError when this tenant has no domain configured', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);

      await expect(createService(repo).verifyDomain()).rejects.toThrow(NotFoundError);
    });

    it('is idempotent — an already-verified domain short-circuits without a DNS lookup', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(createMockDomain({ isVerified: true }));
      const resolveTxt = jest.fn();

      const result = await createService(repo, resolveTxt).verifyDomain();

      expect(resolveTxt).not.toHaveBeenCalled();
      expect(result.isVerified).toBe(true);
    });

    it('marks the domain verified when the real TXT record matches the stored token', async () => {
      const repo = createMockRepository();
      const domain = createMockDomain({ domain: 'portal.acme.com', subdomain: null, isVerified: false, verificationToken: 'expected-token' });
      repo.findByTenantId.mockResolvedValue(domain);
      repo.update.mockResolvedValue({ ...domain, isVerified: true, verifiedAt: new Date() });
      const resolveTxt = jest.fn().mockResolvedValue([['expected-token']]);

      const result = await createService(repo, resolveTxt).verifyDomain();

      expect(resolveTxt).toHaveBeenCalledWith('_cafirm-verify.portal.acme.com');
      expect(repo.update).toHaveBeenCalledWith(domain.id, { isVerified: true, verifiedAt: expect.any(Date) });
      expect(result.isVerified).toBe(true);
    });

    it('leaves the domain unverified when the TXT record does not match', async () => {
      const repo = createMockRepository();
      const domain = createMockDomain({ domain: 'portal.acme.com', subdomain: null, isVerified: false, verificationToken: 'expected-token' });
      repo.findByTenantId.mockResolvedValue(domain);
      const resolveTxt = jest.fn().mockResolvedValue([['some-other-value']]);

      const result = await createService(repo, resolveTxt).verifyDomain();

      expect(repo.update).not.toHaveBeenCalled();
      expect(result.isVerified).toBe(false);
    });

    it('leaves the domain unverified (never throws) when the DNS lookup itself fails — a normal polling outcome', async () => {
      const repo = createMockRepository();
      const domain = createMockDomain({ domain: 'portal.acme.com', subdomain: null, isVerified: false });
      repo.findByTenantId.mockResolvedValue(domain);
      const resolveTxt = jest.fn().mockRejectedValue(Object.assign(new Error('queryTxt ENOTFOUND'), { code: 'ENOTFOUND' }));

      const result = await createService(repo, resolveTxt).verifyDomain();

      expect(repo.update).not.toHaveBeenCalled();
      expect(result.isVerified).toBe(false);
    });
  });

  describe('deleteDomain', () => {
    it('throws NotFoundError when this tenant has no domain configured', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);

      await expect(createService(repo).deleteDomain()).rejects.toThrow(NotFoundError);
    });

    it('deletes the domain scoped to this tenant', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(createMockDomain());

      await createService(repo).deleteDomain();

      expect(repo.deleteByTenantId).toHaveBeenCalledWith(TENANT_ID);
    });
  });
});
