import { Request } from 'express';
import { FirmPaymentGatewaySettings, PaymentGatewayProviderType } from '@prisma/client';

jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { ServiceUnavailableError } from '@shared/errors';
import { CryptoUtils } from '@shared/utils';
import { paymentGatewayEncryptionConfig } from '@config/payment-gateway-encryption';
import { PaymentGatewaySettingsService } from '@modules/client-billing/service/payment-gateway-settings.service';
import { PaymentGatewaySettingsRepository } from '@modules/client-billing/repository/payment-gateway-settings.repository';
import { AuditLogRecorder } from '@modules/audit';

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

type MockedRepository = { findByTenantId: jest.Mock; upsert: jest.Mock };
type MockedAuditLogRecorder = { record: jest.Mock };

function createMockRepository(): MockedRepository {
  return { findByTenantId: jest.fn(), upsert: jest.fn() };
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

function createMockSettingsRow(overrides: Partial<FirmPaymentGatewaySettings> = {}): FirmPaymentGatewaySettings {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'settings-1',
    tenantId: TENANT_ID,
    enabled: true,
    provider: PaymentGatewayProviderType.RAZORPAY,
    keyId: 'rzp_test_key',
    encryptedKeySecret: CryptoUtils.encryptSecret('old-secret', paymentGatewayEncryptionConfig.key as string),
    encryptedWebhookSecret: null,
    isTestMode: true,
    isActive: true,
    createdBy: USER_ID,
    updatedBy: USER_ID,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createService(
  repository: MockedRepository = createMockRepository(),
  auditLogRecorder: MockedAuditLogRecorder = createMockAuditLogRecorder(),
): PaymentGatewaySettingsService {
  return new PaymentGatewaySettingsService(
    createFakeRequest(),
    repository as unknown as PaymentGatewaySettingsRepository,
    auditLogRecorder as unknown as AuditLogRecorder,
  );
}

describe('PaymentGatewaySettingsService', () => {
  describe('getSettings', () => {
    it('returns a DISABLED default when the tenant has no settings row yet', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);

      const result = await createService(repo).getSettings();

      expect(result).toMatchObject({ enabled: false, provider: PaymentGatewayProviderType.DISABLED, isActive: false });
      expect(result).not.toHaveProperty('keySecret');
      expect(result).not.toHaveProperty('webhookSecret');
    });

    it('never exposes the encrypted secrets — only hasKeySecret/hasWebhookSecret booleans', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(createMockSettingsRow());

      const result = await createService(repo).getSettings();

      expect(result.hasKeySecret).toBe(true);
      expect(result.hasWebhookSecret).toBe(false);
      expect(JSON.stringify(result)).not.toContain('old-secret');
      expect(JSON.stringify(result)).not.toMatch(/encryptedKeySecret|encryptedWebhookSecret/);
    });
  });

  describe('updateSettings', () => {
    it('encrypts a newly-provided keySecret before persisting it, and computes isActive: true', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);
      repo.upsert.mockImplementation((_tenantId, data, createdBy) =>
        Promise.resolve(createMockSettingsRow({ ...data, createdBy, updatedBy: data.updatedBy })),
      );

      const service = createService(repo);
      const result = await service.updateSettings({
        enabled: true,
        provider: PaymentGatewayProviderType.RAZORPAY,
        keyId: 'rzp_live_abc',
        keySecret: 'brand-new-secret',
      });

      const [, upsertData] = repo.upsert.mock.calls[0];
      expect(upsertData.encryptedKeySecret).not.toBe('brand-new-secret');
      expect(CryptoUtils.decryptSecret(upsertData.encryptedKeySecret, paymentGatewayEncryptionConfig.key as string)).toBe(
        'brand-new-secret',
      );
      expect(upsertData.isActive).toBe(true);
      expect(result.isActive).toBe(true);
      expect(result.hasKeySecret).toBe(true);
    });

    it('leaves the previously-stored secret untouched when a PATCH omits keySecret', async () => {
      const repo = createMockRepository();
      const existing = createMockSettingsRow();
      repo.findByTenantId.mockResolvedValue(existing);
      repo.upsert.mockImplementation((_tenantId, data) => Promise.resolve({ ...existing, ...data }));

      const service = createService(repo);
      await service.updateSettings({ isTestMode: false });

      const [, upsertData] = repo.upsert.mock.calls[0];
      expect(upsertData.encryptedKeySecret).toBe(existing.encryptedKeySecret);
      expect(upsertData.isTestMode).toBe(false);
    });

    it('computes isActive: false when the firm disables the gateway, even with valid credentials stored', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(createMockSettingsRow());
      repo.upsert.mockImplementation((_tenantId, data) => Promise.resolve({ ...createMockSettingsRow(), ...data }));

      const service = createService(repo);
      const result = await service.updateSettings({ enabled: false });

      expect(result.isActive).toBe(false);
    });

    it('computes isActive: false for RAZORPAY with no key secret ever saved', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);
      repo.upsert.mockImplementation((_tenantId, data) => Promise.resolve({ ...createMockSettingsRow(), ...data, encryptedKeySecret: null }));

      const service = createService(repo);
      const result = await service.updateSettings({ enabled: true, provider: PaymentGatewayProviderType.RAZORPAY, keyId: 'rzp_x' });

      expect(result.isActive).toBe(false);
    });

    it('writes a SETTINGS_UPDATE audit log entry naming the provider and enabled state', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);
      repo.upsert.mockImplementation((_tenantId, data) => Promise.resolve({ ...createMockSettingsRow(), ...data }));
      const audit = createMockAuditLogRecorder();

      await createService(repo, audit).updateSettings({ enabled: true, provider: PaymentGatewayProviderType.RAZORPAY, keySecret: 'x' });

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          actorId: USER_ID,
          eventType: 'SETTINGS_UPDATE',
          targetType: 'FirmPaymentGatewaySettings',
        }),
      );
    });

    it('rejects saving a secret with a clear 503 when PAYMENT_GATEWAY_ENCRYPTION_KEY is not configured', async () => {
      jest.resetModules();
      jest.doMock('@config/payment-gateway-encryption', () => ({
        paymentGatewayEncryptionConfig: { key: undefined, isConfigured: false },
      }));
      jest.doMock('@config/database', () => ({ prisma: {} }));

      const { PaymentGatewaySettingsService: ServiceWithoutKey } = await import(
        '@modules/client-billing/service/payment-gateway-settings.service'
      );
      // Re-imported from the SAME fresh module registry as the service above — `jest.resetModules()`
      // means the statically-imported `ServiceUnavailableError` at the top of this file is a
      // different class object than the one the freshly-imported service throws.
      const { ServiceUnavailableError: ServiceUnavailableErrorAfterRemock } = await import('@shared/errors');
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);

      const service = new ServiceWithoutKey(
        createFakeRequest(),
        repo as unknown as PaymentGatewaySettingsRepository,
        createMockAuditLogRecorder() as unknown as AuditLogRecorder,
      );

      await expect(service.updateSettings({ keySecret: 'anything' })).rejects.toThrow(ServiceUnavailableErrorAfterRemock);
      expect(repo.upsert).not.toHaveBeenCalled();

      jest.dontMock('@config/payment-gateway-encryption');
      jest.resetModules();
    });
  });

  describe('getCapabilities / getHealth', () => {
    it('getCapabilities() resolves the provider from stored settings and returns its capabilities', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(createMockSettingsRow());

      const result = await createService(repo).getCapabilities();

      expect(result).toEqual({
        provider: PaymentGatewayProviderType.RAZORPAY,
        supportsPaymentLinks: true,
        supportsRefunds: true,
        supportsPartialPayments: true,
        supportedCurrencies: ['INR'],
      });
    });

    it('getCapabilities() reports DISABLED when the firm has no settings row', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);

      const result = await createService(repo).getCapabilities();

      expect(result.provider).toBe(PaymentGatewayProviderType.DISABLED);
      expect(result.supportsPaymentLinks).toBe(false);
    });

    it('getHealth() reports unconfigured when the firm has no settings row', async () => {
      const repo = createMockRepository();
      repo.findByTenantId.mockResolvedValue(null);

      const result = await createService(repo).getHealth();

      expect(result.status).toBe('unconfigured');
      expect(result.provider).toBe(PaymentGatewayProviderType.DISABLED);
    });
  });
});
