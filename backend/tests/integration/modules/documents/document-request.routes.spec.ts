import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { DocumentCategory } from '@prisma/client';
import { prisma } from '@config/database';
import { createDocumentRequestTestApp } from '../../helpers/document-request-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Requests API — Integration Tests (PRD §11.4/§11.12)
 * ─────────────────────────────────────────────────────────────────────────────
 * Exercises the full real request lifecycle against a real database, reusing
 * `documents:*` permissions (no dedicated permission for this resource — see
 * `document-request.routes.ts`'s header comment).
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Document Requests API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let businessId: string;

  beforeAll(async () => {
    app = createDocumentRequestTestApp();
    fixtures = await seedFixtures(prisma);
    const client = await prisma.client.findUniqueOrThrow({ where: { id: fixtures.tenantA.clientId } });
    businessId = client.businessId;
  });

  afterAll(async () => {
    await prisma.documentRequest.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenWithPermissions(permissions: string[]): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, permissions });
  }

  describe('permission gating', () => {
    it('returns 403 for POST without documents:create', async () => {
      const res = await request(app)
        .post('/api/v1/document-requests')
        .set('Authorization', `Bearer ${tokenWithPermissions([])}`)
        .send({ businessId, category: DocumentCategory.GST });
      expect(res.status).toBe(403);
    });

    it('returns 403 for GET without documents:read', async () => {
      const res = await request(app).get('/api/v1/document-requests').set('Authorization', `Bearer ${tokenWithPermissions([])}`);
      expect(res.status).toBe(403);
    });
  });

  describe('create / lifecycle', () => {
    let requestId: string;

    it('creates a PENDING request', async () => {
      const res = await request(app)
        .post('/api/v1/document-requests')
        .set('Authorization', `Bearer ${tokenWithPermissions(['documents:create'])}`)
        .send({ businessId, category: DocumentCategory.GST, description: 'Please provide the GST certificate.' });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.requestedById).toBe(fixtures.tenantA.userId);
      requestId = res.body.data.id;
    });

    it('returns 404 for a non-existent business', async () => {
      const res = await request(app)
        .post('/api/v1/document-requests')
        .set('Authorization', `Bearer ${tokenWithPermissions(['documents:create'])}`)
        .send({ businessId: randomUUID(), category: DocumentCategory.GST });
      expect(res.status).toBe(404);
    });

    it('lists it back via GET /document-requests', async () => {
      const res = await request(app)
        .get('/api/v1/document-requests')
        .set('Authorization', `Bearer ${tokenWithPermissions(['documents:read'])}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((r: { id: string }) => r.id === requestId)).toBe(true);
    });

    it('cancels the request', async () => {
      const res = await request(app)
        .post(`/api/v1/document-requests/${requestId}/cancel`)
        .set('Authorization', `Bearer ${tokenWithPermissions(['documents:update'])}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('returns 409 when trying to update a cancelled (non-PENDING) request', async () => {
      const res = await request(app)
        .patch(`/api/v1/document-requests/${requestId}`)
        .set('Authorization', `Bearer ${tokenWithPermissions(['documents:update'])}`)
        .send({ description: 'New description' });
      expect(res.status).toBe(409);
    });
  });

  describe('tenant isolation', () => {
    it('tenant B cannot see tenant A\'s document requests', async () => {
      const created = await prisma.documentRequest.create({
        data: { tenantId: fixtures.tenantA.tenantId, businessId, category: DocumentCategory.PAN, requestedById: fixtures.tenantA.userId },
      });

      const tokenB = signAccessToken({ userId: fixtures.tenantB.userId, tenantId: fixtures.tenantB.tenantId, permissions: ['documents:read'] });
      const res = await request(app).get(`/api/v1/document-requests/${created.id}`).set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });
  });
});
