import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { createTaskTestApp } from '../../helpers/task-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { TASK_TEMPLATE_PERMISSIONS } from '@modules/tasks/constants/task-template.permissions';
import { TASK_PERMISSIONS } from '@modules/tasks/constants/task.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Templates API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PRD §9 — reusable Task blueprints. Exercises the full real request
 * lifecycle against a real database, mirrors `task.routes.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Task Templates API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  const allTemplatePermissions = Object.values(TASK_TEMPLATE_PERMISSIONS);
  const allPermissions = [...allTemplatePermissions, ...Object.values(TASK_PERMISSIONS)];

  beforeAll(async () => {
    app = createTaskTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
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

  async function createTemplate(overrides: Record<string, unknown> = {}): Promise<string> {
    const res = await request(app)
      .post('/api/v1/task-templates')
      .set('Authorization', `Bearer ${tokenForTenantA()}`)
      .send({
        name: `GST Filing ${randomUUID().slice(0, 8)}`,
        type: 'FILING',
        titleTemplate: 'File GST return for {period}',
        dueInDays: 7,
        ...overrides,
      });
    return res.body.data.id;
  }

  describe('permissions', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/task-templates');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks task_templates:create', async () => {
      const res = await request(app)
        .post('/api/v1/task-templates')
        .set('Authorization', `Bearer ${tokenForTenantA([])}`)
        .send({ name: 'X', type: 'FILING', titleTemplate: 'X' });

      expect(res.status).toBe(403);
    });
  });

  describe('CRUD', () => {
    let templateId: string;

    it('POST /task-templates returns 201 and creates the template', async () => {
      const res = await request(app)
        .post('/api/v1/task-templates')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({
          name: 'GST Filing',
          type: 'FILING',
          titleTemplate: 'File GST return for {period}',
          defaultPriority: 'HIGH',
          dueInDays: 7,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'GST Filing',
        type: 'FILING',
        isActive: true,
      });
      templateId = res.body.data.id;
    });

    it('GET /task-templates/:id returns 200 with the template', async () => {
      const res = await request(app)
        .get(`/api/v1/task-templates/${templateId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(templateId);
    });

    it('GET /task-templates returns 200 and includes the created template', async () => {
      const res = await request(app)
        .get('/api/v1/task-templates')
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(templateId);
    });

    it('PATCH /task-templates/:id returns 200 and updates the template', async () => {
      const res = await request(app)
        .patch(`/api/v1/task-templates/${templateId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('DELETE /task-templates/:id returns 200', async () => {
      const res = await request(app)
        .delete(`/api/v1/task-templates/${templateId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
    });

    it('GET /task-templates/:id returns 404 once deleted', async () => {
      const res = await request(app)
        .get(`/api/v1/task-templates/${templateId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(404);
    });
  });

  describe('instantiate', () => {
    it('POST /task-templates/:id/instantiate creates a real Task via the same TaskService.createTask path', async () => {
      const templateId = await createTemplate({ type: 'PAYMENT_FOLLOW_UP', titleTemplate: 'Follow up on invoice' });

      const res = await request(app)
        .post(`/api/v1/task-templates/${templateId}/instantiate`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Follow up on invoice');
      expect(res.body.data.type).toBe('PAYMENT_FOLLOW_UP');
      // Any typed task enters the approval workflow (PRD §9) — starts REQUESTED.
      expect(res.body.data.status).toBe('REQUESTED');

      const task = await prisma.task.findUnique({ where: { id: res.body.data.id } });
      expect(task?.dueDate).not.toBeNull();
    });

    it('instantiate overrides the template defaults when the caller supplies them', async () => {
      const templateId = await createTemplate({ titleTemplate: 'Default title' });

      const res = await request(app)
        .post(`/api/v1/task-templates/${templateId}/instantiate`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ title: 'Custom title override', assigneeId: fixtures.tenantA.userId });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Custom title override');
      expect(res.body.data.assigneeId).toBe(fixtures.tenantA.userId);
    });

    it('returns 409 when instantiating an inactive template', async () => {
      const templateId = await createTemplate();
      await request(app)
        .patch(`/api/v1/task-templates/${templateId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ isActive: false });

      const res = await request(app)
        .post(`/api/v1/task-templates/${templateId}/instantiate`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({});

      expect(res.status).toBe(409);
    });

    it('returns 403 when the caller lacks tasks:create (not gated by a template permission)', async () => {
      const templateId = await createTemplate();

      const res = await request(app)
        .post(`/api/v1/task-templates/${templateId}/instantiate`)
        .set('Authorization', `Bearer ${tokenForTenantA(allTemplatePermissions)}`) // template perms only, no tasks:create
        .send({});

      expect(res.status).toBe(403);
    });
  });

  describe('tenant isolation', () => {
    it("returns 404 when a different tenant's token requests this tenant's template", async () => {
      const templateId = await createTemplate();
      const otherTenantToken = signAccessToken({
        userId: randomUUID(),
        tenantId: randomUUID(),
        permissions: allPermissions,
      });

      const res = await request(app)
        .get(`/api/v1/task-templates/${templateId}`)
        .set('Authorization', `Bearer ${otherTenantToken}`);

      expect(res.status).toBe(404);
    });
  });
});
