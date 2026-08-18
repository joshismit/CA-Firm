import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { IntegrationCategory, IntegrationConnectionStatus, IntegrationWebhookStatus } from '@prisma/client';
import { integrationEncryptionConfig } from '@config/integration-encryption';
import { CryptoUtils } from '@shared/utils';
import { integrationProviderRegistry } from '@modules/integrations/providers/integration-provider.registry';
import { IntegrationProvider } from '@modules/integrations/providers/integration-provider.interface';
import { createIntegrationTestApp } from '../../helpers/integration-test-app';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration Webhook Framework (PRD §17 Step 7) — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Public, unauthenticated route — mirrors `payment-gateway-webhook.routes.spec.ts`.
 * A minimal fake provider is registered under a unique test-only key so this
 * suite can exercise the VERIFIED path — no real provider (Tally/Zoho/...)
 * exists yet (PRD §17 ships the framework only).
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Integration Webhook API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  const providerKey = `test-webhook-provider-${Date.now()}`;
  let connectionId: string;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    fixtures = await seedFixtures(prisma);

    await prisma.integrationProvider.create({
      data: { key: providerKey, name: 'Test Webhook Provider', category: IntegrationCategory.ACCOUNTING, isActive: true },
    });

    const fakeProvider: Partial<IntegrationProvider> = {
      key: providerKey,
      isConfigured: true,
      webhook: jest.fn(async ({ signature }) => {
        if (signature !== 'valid-signature') return { valid: false, shouldProcess: false, error: 'bad signature' };
        return { valid: true, shouldProcess: true, externalEventId: 'evt-fixed-1', payload: { hello: 'world' } };
      }),
    };
    integrationProviderRegistry.register(providerKey, () => fakeProvider as IntegrationProvider, {
      name: 'Test Webhook Provider',
      capabilities: {
        category: IntegrationCategory.ACCOUNTING,
        supportsSync: true,
        supportsWebhooks: true,
        supportsOAuth: false,
        supportedSyncDirections: ['IMPORT'] as never,
      },
    });

    const connection = await prisma.integrationConnection.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        providerKey,
        status: IntegrationConnectionStatus.CONNECTED,
        encryptedCredentials: CryptoUtils.encryptSecret(JSON.stringify({ apiKey: 'x' }), integrationEncryptionConfig.key as string),
      },
    });
    connectionId = connection.id;
  });

  afterAll(async () => {
    const tenantIds = [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId];
    await prisma.integrationJob.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.integrationWebhookLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.integrationSync.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.integrationConnection.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.integrationProvider.deleteMany({ where: { key: providerKey } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  it('returns 200 and logs REJECTED for an unknown connectionId (never seen before)', async () => {
    const unknownId = '00000000-0000-0000-0000-000000000099';
    const res = await request(app).post(`/api/v1/integrations/webhook/${providerKey}/${unknownId}`).send({ event: 'ping' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    const log = await prisma.integrationWebhookLog.findFirst({ where: { providerKey, connectionId: null }, orderBy: { createdAt: 'desc' } });
    expect(log).toMatchObject({ status: IntegrationWebhookStatus.REJECTED, tenantId: null });
  });

  it('returns 200 and logs REJECTED for an invalid signature', async () => {
    const res = await request(app)
      .post(`/api/v1/integrations/webhook/${providerKey}/${connectionId}`)
      .set('x-integration-signature', 'wrong')
      .send({ event: 'ping' });

    expect(res.status).toBe(200);

    const log = await prisma.integrationWebhookLog.findFirst({ where: { connectionId, signatureValid: false }, orderBy: { createdAt: 'desc' } });
    expect(log).toMatchObject({ status: IntegrationWebhookStatus.REJECTED, tenantId: fixtures.tenantA.tenantId });
  });

  it('returns 200, logs VERIFIED, writes an audit entry, and enqueues processing for a valid signature', async () => {
    const res = await request(app)
      .post(`/api/v1/integrations/webhook/${providerKey}/${connectionId}`)
      .set('x-integration-signature', 'valid-signature')
      .send({ event: 'invoice.created' });

    expect(res.status).toBe(200);

    const log = await prisma.integrationWebhookLog.findFirst({
      where: { connectionId, externalEventId: 'evt-fixed-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toMatchObject({ status: IntegrationWebhookStatus.VERIFIED, signatureValid: true, tenantId: fixtures.tenantA.tenantId });

    const auditEntry = await prisma.auditLog.findFirst({
      where: { tenantId: fixtures.tenantA.tenantId, eventType: 'INTEGRATION_WEBHOOK_RECEIVED', targetId: connectionId },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditEntry).not.toBeNull();

    const job = await prisma.integrationJob.findFirst({ where: { relatedWebhookLogId: log!.id } });
    expect(job).not.toBeNull();
  });

  it('is idempotent: replaying the same externalEventId returns the existing log, not a new one', async () => {
    const before = await prisma.integrationWebhookLog.count({ where: { connectionId, externalEventId: 'evt-fixed-1' } });

    const res = await request(app)
      .post(`/api/v1/integrations/webhook/${providerKey}/${connectionId}`)
      .set('x-integration-signature', 'valid-signature')
      .send({ event: 'invoice.created' });

    expect(res.status).toBe(200);
    const after = await prisma.integrationWebhookLog.count({ where: { connectionId, externalEventId: 'evt-fixed-1' } });
    expect(after).toBe(before);
  });
});
