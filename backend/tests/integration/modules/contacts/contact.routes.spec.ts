import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { BusinessStatus, ContactRoleType } from '@prisma/client';
import { prisma } from '@config/database';
import { createContactTestApp } from '../../helpers/contact-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { CONTACT_PERMISSIONS } from '@modules/contacts/constants/contact.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Contacts API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → ContactController → ContactService → ContactRepository /
 *   ContactRoleRepository → Postgres
 *
 * Reuses `seedFixtures`/`cleanupFixtures`/`signAccessToken` from the Project
 * integration suite's helpers (tenant/user-agnostic) and creates its own
 * `BusinessType` + `Business` rows directly via Prisma (not HTTP) — needed
 * as a real target for ContactRole assignment tests, mirroring how the
 * Business suite directly seeds its own `BusinessType` row.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Contacts API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let typeId: string;
  let businessId: string;

  const allPermissions = Object.values(CONTACT_PERMISSIONS);

  beforeAll(async () => {
    app = createContactTestApp();
    fixtures = await seedFixtures(prisma);

    const type = await prisma.businessType.create({
      data: { code: `TEST-CONTACT-BIZ-TYPE-${randomUUID().slice(0, 8)}`, name: 'Integration Test Type' },
    });
    typeId = type.id;

    const business = await prisma.business.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        typeId,
        name: 'Integration Test Business',
        status: BusinessStatus.ACTIVE,
      },
    });
    businessId = business.id;
  });

  afterAll(async () => {
    await prisma.contactRole.deleteMany({ where: { businessId } });
    await prisma.contact.deleteMany({ where: { tenantId: fixtures.tenantA.tenantId } });
    await prisma.contact.deleteMany({ where: { tenantId: fixtures.tenantB.tenantId } });
    await prisma.business.deleteMany({ where: { typeId } });
    await prisma.businessType.delete({ where: { id: typeId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = allPermissions): string {
    return signAccessToken({
      userId: fixtures.tenantA.userId,
      tenantId: fixtures.tenantA.tenantId,
      permissions,
    });
  }

  function tokenForTenantB(permissions: string[] = allPermissions): string {
    return signAccessToken({
      userId: fixtures.tenantB.userId,
      tenantId: fixtures.tenantB.tenantId,
      permissions,
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Authentication / Permission middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('authentication and permission middleware', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/contacts');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller is authenticated but lacks contacts:create', async () => {
      const token = tokenForTenantA([]);
      const res = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'No Permission' });

      expect(res.status).toBe(403);
    });

    it('returns 403 when the caller lacks contacts:delete', async () => {
      const token = tokenForTenantA([CONTACT_PERMISSIONS.READ]);
      const res = await request(app)
        .delete(`/api/v1/contacts/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('validation middleware', () => {
    it('returns 422 when firstName is missing', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ lastName: 'Missing first name' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid email format', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Bad Email', email: 'not-an-email' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid path param (non-UUID id)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get('/api/v1/contacts/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Full lifecycle
  // ────────────────────────────────────────────────────────────────────────
  describe('full lifecycle', () => {
    let contactId: string;

    it('POST /contacts returns 201 and normalizes PAN to uppercase', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Rohan', lastName: 'Mehta', email: 'rohan@example.test', pan: 'abcde1234f' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ firstName: 'Rohan', lastName: 'Mehta', pan: 'ABCDE1234F' });
      contactId = res.body.data.id;
    });

    it('GET /contacts/:id returns 200 with the contact', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(contactId);
    });

    it('GET /contacts/:id returns 404 for a well-formed but unknown id', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/contacts/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('PATCH /contacts/:id returns 200 and updates the contact', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+91 98765 43210' });

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe('+91 98765 43210');
    });

    it('DELETE /contacts/:id returns 200 and soft-deletes the contact', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .delete(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('GET /contacts/:id returns 404 once soft-deleted (excluded by default)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Contact Roles (business assignment)
  // ────────────────────────────────────────────────────────────────────────
  describe('contact roles', () => {
    let contactId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ firstName: 'Priya', lastName: 'Shah' });
      expect(res.status).toBe(201);
      contactId = res.body.data.id;
    });

    it('POST /contacts/roles returns 201 and creates the role assignment', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/contacts/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessId, contactId, roleType: ContactRoleType.DIRECTOR, isPrimary: true });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        businessId,
        contactId,
        roleType: ContactRoleType.DIRECTOR,
        isPrimary: true,
      });
    });

    it('POST /contacts/roles returns 409 for a duplicate (business, contact, roleType)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/contacts/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessId, contactId, roleType: ContactRoleType.DIRECTOR });

      expect(res.status).toBe(409);
    });

    it('POST /contacts/roles returns 409 for a businessId that does not exist (foreign key violation)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/contacts/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessId: randomUUID(), contactId, roleType: ContactRoleType.AUDITOR });

      expect(res.status).toBe(409);
    });

    it('assigning a second primary role clears the first (only one primary per business)', async () => {
      const token = tokenForTenantA();
      const secondContactRes = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Second', lastName: 'Contact' });
      const secondContactId = secondContactRes.body.data.id;

      const res = await request(app)
        .post('/api/v1/contacts/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessId, contactId: secondContactId, roleType: ContactRoleType.PARTNER, isPrimary: true });
      expect(res.status).toBe(201);
      expect(res.body.data.isPrimary).toBe(true);

      const rolesRes = await request(app)
        .get(`/api/v1/contacts/${contactId}/roles`)
        .set('Authorization', `Bearer ${token}`);
      expect(rolesRes.status).toBe(200);
      const directorRole = rolesRes.body.data.find((r: { roleType: string }) => r.roleType === ContactRoleType.DIRECTOR);
      expect(directorRole.isPrimary).toBe(false);
    });

    it('GET /contacts/:id/roles returns 200 with the role list', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/contacts/${contactId}/roles`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    let tenantAContactId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ firstName: 'Tenant A Only' });
      expect(res.status).toBe(201);
      tenantAContactId = res.body.data.id;
    });

    it("returns 404 when tenant B requests tenant A's contact by id", async () => {
      const res = await request(app)
        .get(`/api/v1/contacts/${tenantAContactId}`)
        .set('Authorization', `Bearer ${tokenForTenantB()}`);

      expect(res.status).toBe(404);
    });

    it("does not include tenant A's contact in tenant B's list", async () => {
      const res = await request(app)
        .get('/api/v1/contacts')
        .set('Authorization', `Bearer ${tokenForTenantB()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(tenantAContactId);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Pagination
  // ────────────────────────────────────────────────────────────────────────
  describe('pagination', () => {
    beforeAll(async () => {
      const token = tokenForTenantA();
      for (let i = 1; i <= 3; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app)
          .post('/api/v1/contacts')
          .set('Authorization', `Bearer ${token}`)
          .send({ firstName: `PaginationContact${i}` });
        expect(res.status).toBe(201);
      }
    });

    it('honors page/limit and reports correct pagination metadata', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get('/api/v1/contacts')
        .query({ page: 1, limit: 2, search: 'PaginationContact' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2, hasNextPage: true });
    });
  });
});
