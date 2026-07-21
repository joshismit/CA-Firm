import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { PrismaClient, ProjectStatus, TaskStatus } from '@prisma/client';
import { createTaskTestApp } from '../../helpers/task-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { TASK_PERMISSIONS } from '@modules/tasks/constants/task.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tasks API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → TaskController → TaskService → TaskRepository → Postgres
 *
 * Reuses `seedFixtures`/`cleanupFixtures`/`signAccessToken` from the Project
 * integration suite's helpers (they're already tenant/task-agnostic) and
 * adds one directly-seeded `Project` row per tenant (via Prisma, not HTTP)
 * so the project-scoped filter has something real to point at — Task.projectId
 * is optional, so most tests below don't need a project at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Tasks API — integration', () => {
  let app: Application;
  let prisma: PrismaClient;
  let fixtures: TestFixtures;
  let projectAId: string;

  const allPermissions = Object.values(TASK_PERMISSIONS);

  beforeAll(async () => {
    app = createTaskTestApp();
    prisma = new PrismaClient();
    fixtures = await seedFixtures(prisma);

    const project = await prisma.project.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        clientId: fixtures.tenantA.clientId,
        code: `TASK-IT-${randomUUID().slice(0, 8)}`,
        name: 'Fixture Project For Task Tests',
        status: ProjectStatus.ACTIVE,
      },
    });
    projectAId = project.id;
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

  function tokenForTenantB(permissions: string[] = allPermissions): string {
    return signAccessToken({
      userId: fixtures.tenantB.userId,
      tenantId: fixtures.tenantB.tenantId,
      permissions,
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Permissions (and baseline authentication)
  // ────────────────────────────────────────────────────────────────────────
  describe('permissions', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/tasks');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller is authenticated but lacks tasks:create', async () => {
      const token = tokenForTenantA([]); // valid tenant/user, zero permissions
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'No permission task' });

      expect(res.status).toBe(403);
    });

    it('returns 403 when the caller lacks tasks:manage for restore', async () => {
      const token = tokenForTenantA([TASK_PERMISSIONS.READ]);
      const res = await request(app)
        .patch(`/api/v1/tasks/${randomUUID()}/restore`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation
  // ────────────────────────────────────────────────────────────────────────
  describe('validation', () => {
    it('returns 422 when required fields are missing from the body', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Missing title' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid path param (non-UUID id)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get('/api/v1/tasks/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // CRUD
  // ────────────────────────────────────────────────────────────────────────
  describe('CRUD', () => {
    let taskId: string;

    it('POST /tasks returns 201 and creates the task in TODO', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          projectId: projectAId,
          assigneeId: fixtures.tenantA.userId,
          title: 'Prepare draft financials',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        title: 'Prepare draft financials',
        status: TaskStatus.TODO,
        projectId: projectAId,
      });
      taskId = res.body.data.id;
    });

    it('GET /tasks/:id returns 200 with the task', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(taskId);
    });

    it('GET /tasks/:id returns 404 for a well-formed but unknown id', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/tasks/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('GET /tasks returns 200 and includes the created task', async () => {
      const token = tokenForTenantA();
      const res = await request(app).get('/api/v1/tasks').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(taskId);
    });

    it('PATCH /tasks/:id returns 200 and updates the task', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Prepare final financials' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Prepare final financials');
    });

    it('PATCH /tasks/:id/status TODO → IN_PROGRESS returns 200', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: TaskStatus.IN_PROGRESS });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('PATCH /tasks/:id/status IN_PROGRESS → TODO returns 409 (illegal transition)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: TaskStatus.TODO });

      expect(res.status).toBe(409);
    });

    it('DELETE /tasks/:id returns 409 while the task is IN_PROGRESS (not deletable)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    let tenantATaskId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ title: 'Tenant A only task' });
      tenantATaskId = res.body.data.id;
    });

    it("returns 404 when tenant B requests tenant A's task by id", async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${tenantATaskId}`)
        .set('Authorization', `Bearer ${tokenForTenantB()}`);

      expect(res.status).toBe(404);
    });

    it("does not include tenant A's task in tenant B's list", async () => {
      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenForTenantB()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).not.toContain(tenantATaskId);
    });

    it('tenant A can still fetch its own task', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${tenantATaskId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Soft delete / restore
  // ────────────────────────────────────────────────────────────────────────
  describe('soft delete and restore', () => {
    let deletableTaskId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ title: 'Soft delete me' });
      deletableTaskId = res.body.data.id;
    });

    it('DELETE /tasks/:id returns 200 while the task is TODO', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${deletableTaskId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
    });

    it('GET /tasks/:id returns 404 once soft-deleted (excluded by default)', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${deletableTaskId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(404);
    });

    it('PATCH /tasks/:id/restore returns 200 and reverses the soft delete', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${deletableTaskId}/restore`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
    });

    it('GET /tasks/:id returns 200 again after restore', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${deletableTaskId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
    });

    it('PATCH /tasks/:id/restore returns 409 when the task is not deleted', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${deletableTaskId}/restore`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(409);
    });
  });
});
