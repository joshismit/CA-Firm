import {
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationSync,
  IntegrationSyncDirection,
  IntegrationSyncStatus,
  IntegrationSyncTrigger,
  IntegrationCategory,
  Prisma,
} from '@prisma/client';

jest.mock('@config/database', () => ({ prisma: {} }));
jest.mock('@config/queue', () => ({ integrationSyncQueue: { add: jest.fn().mockResolvedValue(undefined) } }));

import { ConflictError } from '@shared/errors';
import { integrationEncryptionConfig } from '@config/integration-encryption';
import { CryptoUtils } from '@shared/utils';
import { integrationSyncQueue } from '@config/queue';
import { integrationProviderRegistry } from '@modules/integrations/providers/integration-provider.registry';
import { IntegrationProvider } from '@modules/integrations/providers/integration-provider.interface';
import { IntegrationSyncEngine } from '@modules/integrations/service/integration-sync-engine.service';
import { IntegrationConnectionRepository, IntegrationSyncRepository, IntegrationJobRepository } from '@modules/integrations/repository';
import { AuditLogRecorder } from '@modules/audit';

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const CONNECTION_ID = 'connection-33333333-3333-3333-3333-333333333333';

type MockedConnectionRepository = { findById: jest.Mock; updateAfterSync: jest.Mock; findDueForScheduledSync: jest.Mock };
type MockedSyncRepository = { hasActiveRun: jest.Mock; create: jest.Mock; findByIdIgnoreTenant: jest.Mock; update: jest.Mock };
type MockedJobRepository = { create: jest.Mock };
type MockedAuditLogRecorder = { record: jest.Mock };

function createConnectionRepo(): MockedConnectionRepository {
  return { findById: jest.fn(), updateAfterSync: jest.fn(), findDueForScheduledSync: jest.fn() };
}
function createSyncRepo(): MockedSyncRepository {
  return { hasActiveRun: jest.fn().mockResolvedValue(false), create: jest.fn(), findByIdIgnoreTenant: jest.fn(), update: jest.fn() };
}
function createJobRepo(): MockedJobRepository {
  return { create: jest.fn().mockResolvedValue({ id: 'job-1' }) };
}
function createAudit(): MockedAuditLogRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function createEngine(
  connectionRepo: MockedConnectionRepository,
  syncRepo: MockedSyncRepository,
  jobRepo: MockedJobRepository = createJobRepo(),
  audit: MockedAuditLogRecorder = createAudit(),
): IntegrationSyncEngine {
  return new IntegrationSyncEngine(
    connectionRepo as unknown as IntegrationConnectionRepository,
    syncRepo as unknown as IntegrationSyncRepository,
    jobRepo as unknown as IntegrationJobRepository,
    audit as unknown as AuditLogRecorder,
  );
}

function createConnectionRow(overrides: Partial<IntegrationConnection> = {}): IntegrationConnection {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: CONNECTION_ID,
    tenantId: TENANT_ID,
    providerKey: 'tally',
    label: 'My Tally',
    status: IntegrationConnectionStatus.CONNECTED,
    encryptedCredentials: CryptoUtils.encryptSecret(JSON.stringify({ apiKey: 'x' }), integrationEncryptionConfig.key as string),
    scopes: [],
    tokenExpiresAt: null,
    config: {},
    syncDirection: IntegrationSyncDirection.IMPORT,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 30,
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

function createSyncRow(overrides: Partial<IntegrationSync> = {}): IntegrationSync {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'sync-1',
    tenantId: TENANT_ID,
    connectionId: CONNECTION_ID,
    direction: IntegrationSyncDirection.IMPORT,
    trigger: IntegrationSyncTrigger.MANUAL,
    status: IntegrationSyncStatus.PENDING,
    idempotencyKey: 'key-1',
    isDryRun: false,
    startedAt: null,
    completedAt: null,
    itemsProcessed: 0,
    itemsSucceeded: 0,
    itemsFailed: 0,
    conflictCount: 0,
    resultSummary: Prisma.JsonNull,
    errorMessage: null,
    triggeredBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as IntegrationSync;
}

describe('IntegrationSyncEngine', () => {
  afterEach(() => jest.clearAllMocks());

  describe('triggerManual', () => {
    it('throws NotFoundError-ish when the connection does not belong to the tenant', async () => {
      const connectionRepo = createConnectionRepo();
      connectionRepo.findById.mockResolvedValue(null);
      const syncRepo = createSyncRepo();

      await expect(
        createEngine(connectionRepo, syncRepo).triggerManual({ tenantId: TENANT_ID, connectionId: CONNECTION_ID, userId: USER_ID }),
      ).rejects.toThrow();
    });

    it('throws ConflictError when a sync is already PENDING/RUNNING for this connection', async () => {
      const connectionRepo = createConnectionRepo();
      connectionRepo.findById.mockResolvedValue(createConnectionRow());
      const syncRepo = createSyncRepo();
      syncRepo.hasActiveRun.mockResolvedValue(true);

      await expect(
        createEngine(connectionRepo, syncRepo).triggerManual({ tenantId: TENANT_ID, connectionId: CONNECTION_ID, userId: USER_ID }),
      ).rejects.toThrow(ConflictError);
    });

    it('creates a PENDING IntegrationSync row and enqueues it onto integrationSyncQueue', async () => {
      const connectionRepo = createConnectionRepo();
      connectionRepo.findById.mockResolvedValue(createConnectionRow());
      const syncRepo = createSyncRepo();
      syncRepo.create.mockImplementation((data) => Promise.resolve(createSyncRow(data)));

      const sync = await createEngine(connectionRepo, syncRepo).triggerManual({
        tenantId: TENANT_ID,
        connectionId: CONNECTION_ID,
        userId: USER_ID,
      });

      expect(sync.status).toBe(IntegrationSyncStatus.PENDING);
      expect(sync.trigger).toBe(IntegrationSyncTrigger.MANUAL);
      expect(integrationSyncQueue.add).toHaveBeenCalledWith('sync', { syncId: sync.id }, { jobId: sync.id });
    });
  });

  describe('executeSync — status resolution', () => {
    /** Each test registers its OWN unique key — `integrationProviderRegistry` is a module-level
     *  singleton that throws on a duplicate `register()` call, so a shared key across `it()` blocks
     *  would make every test after the first fail (see the registry's own header comment). */
    function registerFakeProvider(syncResult: Partial<Awaited<ReturnType<IntegrationProvider['sync']>>>): string {
      const key = `test-engine-${Math.random().toString(36).slice(2, 10)}`;
      const provider: Partial<IntegrationProvider> = {
        key,
        isConfigured: true,
        sync: jest.fn().mockResolvedValue({ success: true, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0, ...syncResult }),
      };
      integrationProviderRegistry.register(key, () => provider as IntegrationProvider, {
        name: 'Test Engine Provider',
        capabilities: {
          category: IntegrationCategory.ACCOUNTING,
          supportsSync: true,
          supportsWebhooks: false,
          supportsOAuth: false,
          supportedSyncDirections: [IntegrationSyncDirection.IMPORT],
        },
      });
      return key;
    }

    it('resolves to SUCCESS when every item succeeds', async () => {
      const providerKey = registerFakeProvider({ itemsProcessed: 5, itemsSucceeded: 5, itemsFailed: 0 });
      const connectionRepo = createConnectionRepo();
      const connection = createConnectionRow({ providerKey });
      connectionRepo.findById.mockResolvedValue(connection);
      const syncRepo = createSyncRepo();
      syncRepo.findByIdIgnoreTenant.mockResolvedValue(createSyncRow());
      syncRepo.update.mockImplementation((_id, data) => Promise.resolve({ ...createSyncRow(), ...data }));

      await createEngine(connectionRepo, syncRepo).executeSync('sync-1');

      const [, updateData] = syncRepo.update.mock.calls[syncRepo.update.mock.calls.length - 1];
      expect(updateData.status).toBe(IntegrationSyncStatus.SUCCESS);
      expect(connectionRepo.updateAfterSync).toHaveBeenCalledWith(
        connection.id,
        expect.objectContaining({ status: IntegrationConnectionStatus.CONNECTED }),
        expect.anything(),
      );
    });

    it('resolves to PARTIAL_SUCCESS when some items fail and some succeed', async () => {
      const providerKey = registerFakeProvider({ itemsProcessed: 10, itemsSucceeded: 7, itemsFailed: 3 });
      const connectionRepo = createConnectionRepo();
      connectionRepo.findById.mockResolvedValue(createConnectionRow({ providerKey }));
      const syncRepo = createSyncRepo();
      syncRepo.findByIdIgnoreTenant.mockResolvedValue(createSyncRow());
      syncRepo.update.mockImplementation((_id, data) => Promise.resolve({ ...createSyncRow(), ...data }));

      await createEngine(connectionRepo, syncRepo).executeSync('sync-1');

      const [, updateData] = syncRepo.update.mock.calls[syncRepo.update.mock.calls.length - 1];
      expect(updateData.status).toBe(IntegrationSyncStatus.PARTIAL_SUCCESS);
    });

    it('resolves to FAILED and marks the connection ERROR when nothing succeeds', async () => {
      const providerKey = registerFakeProvider({ success: false, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0, error: 'boom' });
      const connectionRepo = createConnectionRepo();
      connectionRepo.findById.mockResolvedValue(createConnectionRow({ providerKey }));
      const syncRepo = createSyncRepo();
      syncRepo.findByIdIgnoreTenant.mockResolvedValue(createSyncRow());
      syncRepo.update.mockImplementation((_id, data) => Promise.resolve({ ...createSyncRow(), ...data }));

      await createEngine(connectionRepo, syncRepo).executeSync('sync-1');

      const [, updateData] = syncRepo.update.mock.calls[syncRepo.update.mock.calls.length - 1];
      expect(updateData.status).toBe(IntegrationSyncStatus.FAILED);
      expect(connectionRepo.updateAfterSync).toHaveBeenCalledWith(
        CONNECTION_ID,
        expect.objectContaining({ status: IntegrationConnectionStatus.ERROR, lastError: 'boom' }),
        expect.anything(),
      );
    });

    it('an unregistered provider (every provider today) resolves the sync to FAILED via DisabledIntegrationProvider', async () => {
      const connectionRepo = createConnectionRepo();
      connectionRepo.findById.mockResolvedValue(createConnectionRow({ providerKey: 'never-registered' }));
      const syncRepo = createSyncRepo();
      syncRepo.findByIdIgnoreTenant.mockResolvedValue(createSyncRow());
      syncRepo.update.mockImplementation((_id, data) => Promise.resolve({ ...createSyncRow(), ...data }));

      await createEngine(connectionRepo, syncRepo).executeSync('sync-1');

      const [, updateData] = syncRepo.update.mock.calls[syncRepo.update.mock.calls.length - 1];
      expect(updateData.status).toBe(IntegrationSyncStatus.FAILED);
    });
  });
});
