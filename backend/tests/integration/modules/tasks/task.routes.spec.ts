import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { ProjectStatus, TaskStatus } from '@prisma/client';
import { prisma } from '@config/database';
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
  let fixtures: TestFixtures;
  let projectAId: string;

  const allPermissions = Object.values(TASK_PERMISSIONS);

  beforeAll(async () => {
    app = createTaskTestApp();
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
  // Approval workflow (PRD §9)
  // ────────────────────────────────────────────────────────────────────────
  describe('approval workflow (PRD §9)', () => {
    async function createApprovalTask(): Promise<string> {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ title: 'Approve Q1 payroll run', type: 'APPROVAL' });
      return res.body.data.id;
    }

    it('POST /tasks with a type starts the task in REQUESTED (not TODO)', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ title: 'Approve Q1 payroll run', type: 'APPROVAL' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ status: TaskStatus.REQUESTED, type: 'APPROVAL' });
    });

    it('walks a task through the full approval lifecycle: submit → approve → complete', async () => {
      const taskId = await createApprovalTask();
      const token = tokenForTenantA();

      const submitRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/submit`)
        .set('Authorization', `Bearer ${token}`);
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.data.status).toBe(TaskStatus.SUBMITTED);

      const approveRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/approve`)
        .set('Authorization', `Bearer ${token}`);
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe(TaskStatus.APPROVED);
      expect(approveRes.body.data.approvedBy).toBe(fixtures.tenantA.userId);

      const completeRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/complete`)
        .set('Authorization', `Bearer ${token}`);
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe(TaskStatus.COMPLETED);
      expect(completeRes.body.data.completedBy).toBe(fixtures.tenantA.userId);
    });

    it('rejecting a submitted task requires a reason and stamps rejectedBy', async () => {
      const taskId = await createApprovalTask();
      const token = tokenForTenantA();
      await request(app).post(`/api/v1/tasks/${taskId}/submit`).set('Authorization', `Bearer ${token}`);

      const missingReasonRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(missingReasonRes.status).toBe(422);

      const rejectRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Missing supporting documents' });
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe(TaskStatus.REJECTED);
      expect(rejectRes.body.data.rejectedBy).toBe(fixtures.tenantA.userId);
    });

    it('POST /tasks/:id/reopen moves a REJECTED task back to REQUESTED', async () => {
      const taskId = await createApprovalTask();
      const token = tokenForTenantA();
      await request(app).post(`/api/v1/tasks/${taskId}/submit`).set('Authorization', `Bearer ${token}`);
      await request(app)
        .post(`/api/v1/tasks/${taskId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Needs rework' });

      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/reopen`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TaskStatus.REQUESTED);
    });

    it('rejects the PRD\'s explicit invalid-transition example: APPROVED → SUBMITTED', async () => {
      const taskId = await createApprovalTask();
      const token = tokenForTenantA();
      await request(app).post(`/api/v1/tasks/${taskId}/submit`).set('Authorization', `Bearer ${token}`);
      await request(app).post(`/api/v1/tasks/${taskId}/approve`).set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: TaskStatus.SUBMITTED });

      expect(res.status).toBe(409);
    });

    it('POST /tasks/:id/assign reassigns the task and requires tasks:assign', async () => {
      const taskId = await createApprovalTask();

      const forbiddenRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/assign`)
        .set('Authorization', `Bearer ${tokenForTenantA(allPermissions.filter((p) => p !== TASK_PERMISSIONS.ASSIGN))}`)
        .send({ assigneeId: fixtures.tenantA.userId });
      expect(forbiddenRes.status).toBe(403);

      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/assign`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ assigneeId: fixtures.tenantA.userId });
      expect(res.status).toBe(200);
      expect(res.body.data.assigneeId).toBe(fixtures.tenantA.userId);
    });

    it('POST /tasks/:id/approve returns 403 without tasks:approve', async () => {
      const taskId = await createApprovalTask();
      const token = tokenForTenantA();
      await request(app).post(`/api/v1/tasks/${taskId}/submit`).set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/approve`)
        .set('Authorization', `Bearer ${tokenForTenantA(allPermissions.filter((p) => p !== TASK_PERMISSIONS.APPROVE))}`);

      expect(res.status).toBe(403);
    });

    it('POST /tasks/:id/complete returns 403 without tasks:complete', async () => {
      const taskId = await createApprovalTask();
      const token = tokenForTenantA();
      await request(app).post(`/api/v1/tasks/${taskId}/submit`).set('Authorization', `Bearer ${token}`);
      await request(app).post(`/api/v1/tasks/${taskId}/approve`).set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/complete`)
        .set('Authorization', `Bearer ${tokenForTenantA(allPermissions.filter((p) => p !== TASK_PERMISSIONS.COMPLETE))}`);

      expect(res.status).toBe(403);
    });

    it('GET /tasks/pending-review returns SUBMITTED/UNDER_REVIEW tasks and requires tasks:review', async () => {
      const taskId = await createApprovalTask();
      const token = tokenForTenantA();
      await request(app).post(`/api/v1/tasks/${taskId}/submit`).set('Authorization', `Bearer ${token}`);

      const forbiddenRes = await request(app)
        .get('/api/v1/tasks/pending-review')
        .set('Authorization', `Bearer ${tokenForTenantA(allPermissions.filter((p) => p !== TASK_PERMISSIONS.REVIEW))}`);
      expect(forbiddenRes.status).toBe(403);

      const res = await request(app)
        .get('/api/v1/tasks/pending-review')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(taskId);
    });

    it('GET /tasks/overdue includes an overdue REQUESTED task (behavior widens with the new statuses)', async () => {
      const token = tokenForTenantA();
      const createRes = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Overdue approval task', type: 'APPROVAL', dueDate: '2020-01-01' });
      const overdueTaskId = createRes.body.data.id;

      const res = await request(app).get('/api/v1/tasks/overdue').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(overdueTaskId);
    });

    it('audit-logs TASK_CREATED, TASK_SUBMITTED, and TASK_APPROVED across the lifecycle', async () => {
      const taskId = await createApprovalTask();
      const token = tokenForTenantA();
      await request(app).post(`/api/v1/tasks/${taskId}/submit`).set('Authorization', `Bearer ${token}`);
      await request(app).post(`/api/v1/tasks/${taskId}/approve`).set('Authorization', `Bearer ${token}`);

      const events = await prisma.auditLog.findMany({
        where: { tenantId: fixtures.tenantA.tenantId, targetType: 'Task', targetId: taskId },
        select: { eventType: true },
      });
      const eventTypes = events.map((e) => e.eventType);
      expect(eventTypes).toContain('TASK_CREATED');
      expect(eventTypes).toContain('TASK_SUBMITTED');
      expect(eventTypes).toContain('TASK_APPROVED');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // CRM Lead linkage (PRD §8.7) — a follow-up Task reusable for a pre-conversion Lead.
  // ────────────────────────────────────────────────────────────────────────
  describe('CRM Lead linkage', () => {
    let leadAId: string;
    let leadSourceAId: string;
    let leadStageAId: string;

    beforeAll(async () => {
      const source = await prisma.leadSource.create({
        data: { tenantId: fixtures.tenantA.tenantId, name: `Referral-${randomUUID().slice(0, 8)}` },
      });
      leadSourceAId = source.id;
      const stage = await prisma.leadStage.create({
        data: { tenantId: fixtures.tenantA.tenantId, name: `New-${randomUUID().slice(0, 8)}`, order: 1 },
      });
      leadStageAId = stage.id;
      const lead = await prisma.lead.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          title: 'Fixture Lead For Task Tests',
          sourceId: source.id,
          stageId: stage.id,
        },
      });
      leadAId = lead.id;
    });

    afterAll(async () => {
      // Task.leadId is `onDelete: SetNull`, so deleting the Lead is safe even
      // with tasks still referencing it — mirrors how business.routes.spec.ts
      // cleans up its own directly-seeded BusinessType.
      await prisma.lead.delete({ where: { id: leadAId } });
      await prisma.leadStage.delete({ where: { id: leadStageAId } });
      await prisma.leadSource.delete({ where: { id: leadSourceAId } });
    });

    it('POST /tasks creates a follow-up task linked to a Lead (no Project required)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ leadId: leadAId, title: 'Call back next week' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ leadId: leadAId, projectId: null });
    });

    it('GET /tasks/lead/:leadId returns 200 with the follow-up task', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/tasks/lead/${leadAId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((t: { leadId: string }) => t.leadId === leadAId)).toBe(true);
    });

    it('GET /tasks/lead/:leadId returns 403 when the caller lacks tasks:read', async () => {
      const token = tokenForTenantA([]);
      const res = await request(app)
        .get(`/api/v1/tasks/lead/${leadAId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('completing a Lead-linked task audit-logs FOLLOWUP_COMPLETED', async () => {
      const token = tokenForTenantA();
      const createRes = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ leadId: leadAId, title: 'Send proposal follow-up' });
      const followUpTaskId = createRes.body.data.id;

      await request(app)
        .patch(`/api/v1/tasks/${followUpTaskId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: TaskStatus.IN_PROGRESS });
      await request(app)
        .patch(`/api/v1/tasks/${followUpTaskId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: TaskStatus.REVIEW });
      const res = await request(app)
        .patch(`/api/v1/tasks/${followUpTaskId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: TaskStatus.COMPLETED });

      expect(res.status).toBe(200);

      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          tenantId: fixtures.tenantA.tenantId,
          eventType: 'FOLLOWUP_COMPLETED',
          targetType: 'Lead',
          targetId: leadAId,
        },
      });
      expect(auditEntry).not.toBeNull();
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
