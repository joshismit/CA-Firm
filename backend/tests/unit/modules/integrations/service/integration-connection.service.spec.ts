import { Request } from 'express';
import { IntegrationConnection, IntegrationConnectionStatus, IntegrationProvider as IntegrationProviderRow, IntegrationCategory } from '@prisma/client';

jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { ForbiddenError, NotFoundError } from '@shared/errors';
import { integrationEncryptionConfig } from '@config/integration-encryption';
import { CryptoUtils } from '@shared/utils';
import { IntegrationConnectionService } from '@modules/integrations/service/integration-connection.service';
import { IntegrationConnectionRepository, IntegrationProviderRepository } from '@modules/integrations/repository';
import { AuditLogRecorder } from '@modules/audit';

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

type MockedConnectionRepository = {
  listByTenant: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};
type MockedProviderRepository = { findAll: jest.Mock; findByKey: jest.Mock };
type MockedAuditLogRecorder = { record: jest.Mock };

function createMockConnectionRepository(): MockedConnectionRepository {
  return { listByTenant: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn() };
}
function createMockProviderRepository(): MockedProviderRepository {
  return { findAll: jest.fn().mockResolvedValue([]), findByKey: jest.fn() };
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

function createProviderRow(overrides: Partial<IntegrationProviderRow> = {}): IntegrationProviderRow {
  return {
    id: 'provider-row-1',
    key: 'tally',
    name: 'Tally',
    category: IntegrationCategory.ACCOUNTING,
    description: null,
    isActive: true,
    capabilities: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createConnectionRow(overrides: Partial<IntegrationConnection> = {}): IntegrationConnection {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'connection-1',
    tenantId: TENANT_ID,
    providerKey: 'tally',
    label: null,
    status: IntegrationConnectionStatus.PENDING,
    encryptedCredentials: CryptoUtils.encryptSecret(JSON.stringify({ apiKey: 'x' }), integrationEncryptionConfig.key as string),
    scopes: [],
    tokenExpiresAt: null,
    config: {},
    syncDirection: 'IMPORT',
    autoSyncEnabled: false,
    syncFrequencyMinutes: null,
    lastSyncAt: null,
    nextSyncAt: null,
    lastError: null,
    metadata: null,
    createdBy: USER_ID,
    updatedBy: USER_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as IntegrationConnection;
}

function createService(
  connectionRepository: MockedConnectionRepository = createMockConnectionRepository(),
  providerRepository: MockedProviderRepository = createMockProviderRepository(),
  auditLogRecorder: MockedAuditLogRecorder = createMockAuditLogRecorder(),
): IntegrationConnectionService {
  return new IntegrationConnectionService(
    createFakeRequest(),
    connectionRepository as unknown as IntegrationConnectionRepository,
    providerRepository as unknown as IntegrationProviderRepository,
    auditLogRecorder as unknown as AuditLogRecorder,
  );
}

describe('IntegrationConnectionService', () => {
  describe('connect', () => {
    it('throws NotFoundError when the providerKey has no catalog row', async () => {
      const providerRepo = createMockProviderRepository();
      providerRepo.findByKey.mockResolvedValue(null);

      await expect(
        createService(undefined, providerRepo).connect({ providerKey: 'unknown', credentials: { apiKey: 'x' } }),
      ).rejects.toThrow(NotFoundError);
    });

    it('stores encrypted credentials and marks the connection PENDING when no real provider is registered yet', async () => {
      const connectionRepo = createMockConnectionRepository();
      const providerRepo = createMockProviderRepository();
      providerRepo.findByKey.mockResolvedValue(createProviderRow());
      connectionRepo.create.mockImplementation((data) => Promise.resolve(createConnectionRow(data)));

      const result = await createService(connectionRepo, providerRepo).connect({
        providerKey: 'tally',
        credentials: { apiKey: 'super-secret' },
      });

      const [createData] = connectionRepo.create.mock.calls[0];
      expect(createData.status).toBe(IntegrationConnectionStatus.PENDING);
      expect(createData.encryptedCredentials).not.toContain('super-secret');
      expect(
        CryptoUtils.decryptSecret(createData.encryptedCredentials, integrationEncryptionConfig.key as string),
      ).toBe(JSON.stringify({ apiKey: 'super-secret' }));
      expect(result.hasCredentials).toBe(true);
      expect(JSON.stringify(result)).not.toContain('super-secret');
    });

    it('writes an INTEGRATION_CONNECTED audit entry on first connect, INTEGRATION_CREDENTIAL_UPDATED when rotating', async () => {
      const connectionRepo = createMockConnectionRepository();
      const providerRepo = createMockProviderRepository();
      const audit = createMockAuditLogRecorder();
      providerRepo.findByKey.mockResolvedValue(createProviderRow());
      connectionRepo.create.mockImplementation((data) => Promise.resolve(createConnectionRow(data)));

      await createService(connectionRepo, providerRepo, audit).connect({ providerKey: 'tally', credentials: { apiKey: 'x' } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'INTEGRATION_CONNECTED' }));

      const existing = createConnectionRow();
      connectionRepo.findById.mockResolvedValue(existing);
      connectionRepo.update.mockImplementation((_id, data) => Promise.resolve({ ...existing, ...data }));

      await createService(connectionRepo, providerRepo, audit).connect({
        providerKey: 'tally',
        connectionId: existing.id,
        credentials: { apiKey: 'y' },
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'INTEGRATION_CREDENTIAL_UPDATED' }));
    });

    it('rejects with 503 when INTEGRATION_ENCRYPTION_KEY is not configured', async () => {
      jest.resetModules();
      jest.doMock('@config/integration-encryption', () => ({ integrationEncryptionConfig: { key: undefined, isConfigured: false } }));
      jest.doMock('@config/database', () => ({ prisma: {} }));

      const { IntegrationConnectionService: ServiceWithoutKey } = await import(
        '@modules/integrations/service/integration-connection.service'
      );
      const { ServiceUnavailableError: ServiceUnavailableErrorAfterRemock } = await import('@shared/errors');

      const providerRepo = createMockProviderRepository();
      providerRepo.findByKey.mockResolvedValue(createProviderRow());

      const service = new ServiceWithoutKey(
        createFakeRequest(),
        createMockConnectionRepository() as unknown as IntegrationConnectionRepository,
        providerRepo as unknown as IntegrationProviderRepository,
        createMockAuditLogRecorder() as unknown as AuditLogRecorder,
      );

      await expect(service.connect({ providerKey: 'tally', credentials: { apiKey: 'x' } })).rejects.toThrow(
        ServiceUnavailableErrorAfterRemock,
      );

      jest.dontMock('@config/integration-encryption');
      jest.resetModules();
    });
  });

  describe('disconnect', () => {
    it('throws NotFoundError for a connection outside the caller tenant', async () => {
      const connectionRepo = createMockConnectionRepository();
      connectionRepo.findById.mockResolvedValue(null);

      await expect(createService(connectionRepo).disconnect('missing-id')).rejects.toThrow(NotFoundError);
    });

    it('marks the connection DISCONNECTED and turns off auto-sync', async () => {
      const connectionRepo = createMockConnectionRepository();
      const providerRepo = createMockProviderRepository();
      const existing = createConnectionRow({ status: IntegrationConnectionStatus.CONNECTED, autoSyncEnabled: true });
      connectionRepo.findById.mockResolvedValue(existing);
      connectionRepo.update.mockImplementation((_id, data) => Promise.resolve({ ...existing, ...data }));
      providerRepo.findByKey.mockResolvedValue(createProviderRow());

      const result = await createService(connectionRepo, providerRepo).disconnect(existing.id);

      const [, updateData] = connectionRepo.update.mock.calls[0];
      expect(updateData).toMatchObject({ status: IntegrationConnectionStatus.DISCONNECTED, autoSyncEnabled: false, nextSyncAt: null });
      expect(result.status).toBe(IntegrationConnectionStatus.DISCONNECTED);
    });
  });

  describe('tenant scoping', () => {
    it('throws ForbiddenError when the request has no tenant', async () => {
      const service = new IntegrationConnectionService(
        { tenant: undefined, user: { id: USER_ID }, correlationId: 'x' } as unknown as Request,
        createMockConnectionRepository() as unknown as IntegrationConnectionRepository,
        createMockProviderRepository() as unknown as IntegrationProviderRepository,
        createMockAuditLogRecorder() as unknown as AuditLogRecorder,
      );

      await expect(service.listConnections()).rejects.toThrow(ForbiddenError);
    });
  });
});
