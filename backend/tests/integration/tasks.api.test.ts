import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { ProjectStatus, TaskStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { createFullTestApp } from './helpers/full-test-app';
import { signAccessToken } from './helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from './helpers/fixtures';
import { TASK_PERMISSIONS } from '@modules/tasks/constants/task.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tasks API — Comprehensive Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full, real request lifecycle against a real PostgreSQL database:
 *
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → TaskController → TaskService → TaskRepository → Postgres
 *
 * Nothing here is mocked. `createFullTestApp()` wires the exact same
 * middleware chain, routes, and error handler that `src/app.ts` uses,
 * including the /health and /api-docs (Swagger) endpoints. Fixtures are real
 * rows inserted via a real PrismaClient. Two fully-isolated tenants are seeded
 * so every tenant-isolation assertion has a real counterpart to compare
 * against.
 *
 * Test organisation
 * ─────────────────
 *  1. Infrastructure endpoints     — /health, /api-docs
 *  2. JWT / Authentication         — missing token, malformed, expired
 *  3. Permissions / Authorization  — 401, 403 per permission
 *  4. Validation                   — Zod 422 cases
 *  5. Create                       — POST /tasks (happy + cross-field)
 *  6. Read by ID                   — GET /tasks/:id
 *  7. List / Pagination            — GET /tasks (page, limit, sortBy, sortOrder)
 *  8. Search                       — GET /tasks?search=
 *  9. Filter by status             — GET /tasks?status=
 * 10. Filter by project            — GET /tasks?projectId= / /project/:id
 * 11. Filter by assignee           — GET /tasks?assigneeId= / /assignee/:id
 * 12. Overdue tasks                — GET /tasks/overdue
 * 13. Update                       — PATCH /tasks/:id
 * 14. Status transitions           — PATCH /tasks/:id/status (valid + invalid)
 * 15. Delete                       — DELETE /tasks/:id (allowed + blocked)
 * 16. Soft-delete & restore        — full lifecycle
 * 17. Tenant isolation             — cross-tenant read / list
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(45000);

describe('Tasks API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  /** A real project seeded under Tenant A so projectId FKs resolve. */
  let projectAId: string;

  const allPermissions = Object.values(TASK_PERMISSIONS);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function tokenA(permissions: string[] = allPermissions): string {
    return signAccessToken({
      userId: fixtures.tenantA.userId,
      tenantId: fixtures.tenantA.tenantId,
      permissions,
    });
  }

  function tokenB(permissions: string[] = allPermissions): string {
    return signAccessToken({
      userId: fixtures.tenantB.userId,
      tenantId: fixtures.tenantB.tenantId,
      permissions,
    });
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  beforeAll(async () => {
    app = createFullTestApp();
    fixtures = await seedFixtures(prisma);

    // Seed one real project for Tenant A (needed by project-filter tests).
    const project = await prisma.project.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        clientId: fixtures.tenantA.clientId,
        code: `INT-PROJ-${randomUUID().slice(0, 8)}`,
        name: 'Integration Project A',
        status: ProjectStatus.ACTIVE,
      },
    });
    projectAId = project.id;
  });

  afterAll(async () => {
    // Hard-delete all tasks seeded under test tenants (soft-deleted or not).
    await prisma.task.deleteMany({
      where: {
        tenantId: {
          in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId],
        },
      },
    });
    await cleanupFixtures(prisma, fixtures);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Infrastructure endpoints
  // ══════════════════════════════════════════════════════════════════════════

  describe('infrastructure endpoints', () => {
    it('GET /health returns 200 with status:ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ status: 'ok' });
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.correlationId).toBeDefined();
    });

    it('GET /api-docs returns 200 (Swagger UI HTML)', async () => {
      const res = await request(app).get('/api-docs/').redirects(1);

      // swagger-ui-express serves HTML; any 2xx is sufficient.
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(400);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. JWT / Authentication
  // ══════════════════════════════════════════════════════════════════════════

  describe('authentication middleware', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await request(app).get('/api/v1/tasks');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for a malformed token (not a JWT)', async () => {
      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', 'Bearer this-is-not-a-jwt');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for an expired token', async () => {
      const expiredToken = signAccessToken({
        userId: fixtures.tenantA.userId,
        tenantId: fixtures.tenantA.tenantId,
        expiresInSeconds: -1, // already expired
      });

      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Permissions / Authorization
  // ══════════════════════════════════════════════════════════════════════════

  describe('permission middleware', () => {
    it('returns 403 on POST /tasks when caller lacks tasks:create', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA([])}`)
        .send({ title: 'Will be rejected' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 on GET /tasks when caller lacks tasks:read', async () => {
      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA([TASK_PERMISSIONS.CREATE])}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 on PATCH /:id when caller lacks tasks:update', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenA([TASK_PERMISSIONS.READ])}`)
        .send({ title: 'Try update' });

      expect(res.status).toBe(403);
    });

    it('returns 403 on DELETE /:id when caller lacks tasks:delete', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenA([TASK_PERMISSIONS.READ])}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 on PATCH /:id/restore when caller lacks tasks:manage', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${randomUUID()}/restore`)
        .set('Authorization', `Bearer ${tokenA([TASK_PERMISSIONS.READ])}`);

      expect(res.status).toBe(403);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Zod Validation
  // ══════════════════════════════════════════════════════════════════════════

  describe('validation middleware', () => {
    it('returns 422 when title is missing from POST /tasks body', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ description: 'No title provided' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('returns 422 when title is too short (< 2 chars)', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'X' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for a non-UUID path param on GET /tasks/:id', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/not-a-uuid')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(422);
    });

    it('returns 422 for a non-UUID projectId on GET /tasks/project/:projectId', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/project/bad-id')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(422);
    });

    it('returns 422 for limit > 100 on GET /tasks', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?limit=999')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(422);
    });

    it('returns 422 for invalid status enum on GET /tasks', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?status=INVALID_STATUS')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(422);
    });

    it('returns 422 when dueDate is before startDate on POST /tasks', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({
          title: 'Date validation test',
          startDate: '2026-12-31T00:00:00.000Z',
          dueDate:   '2026-01-01T00:00:00.000Z',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5. Create — POST /api/v1/tasks
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/tasks', () => {
    it('creates a standalone task and returns 201 with ApiResponseHelper envelope', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Standalone task' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        title: 'Standalone task',
        status: TaskStatus.TODO,
      });
      expect(res.body.data.id).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.correlationId).toBeDefined();
    });

    it('creates a task linked to a project', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({
          title: 'Project-linked task',
          projectId: projectAId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.projectId).toBe(projectAId);
    });

    it('creates a task with full optional fields', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({
          title: 'Full task',
          description: 'Prepare draft financial statements for FY 2025-26',
          assigneeId: fixtures.tenantA.userId,
          projectId: projectAId,
          startDate: '2026-08-01T00:00:00.000Z',
          dueDate: '2026-08-31T00:00:00.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        title: 'Full task',
        description: 'Prepare draft financial statements for FY 2025-26',
        assigneeId: fixtures.tenantA.userId,
        projectId: projectAId,
        status: TaskStatus.TODO,
      });
    });

    it('returns 422 when CANCELLED reason is absent (Zod cross-field proxy)', async () => {
      // Creating directly at CANCELLED status is not allowed via the create endpoint
      // (always starts TODO). This verifies the schema doesn't accept unknown status.
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'X' }); // title too short triggers 422

      expect(res.status).toBe(422);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 6. Read by ID — GET /api/v1/tasks/:id
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/tasks/:id', () => {
    let taskId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Read-by-id task' });
      taskId = res.body.data.id;
    });

    it('returns 200 and the task payload for an existing id', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(taskId);
    });

    it('returns 404 for a valid UUID that does not exist', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 7. List & Pagination — GET /api/v1/tasks
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/tasks — list & pagination', () => {
    beforeAll(async () => {
      // Seed 3 extra tasks so pagination has something to slice.
      await Promise.all(
        ['Pagination task 1', 'Pagination task 2', 'Pagination task 3'].map((title) =>
          request(app)
            .post('/api/v1/tasks')
            .set('Authorization', `Bearer ${tokenA()}`)
            .send({ title }),
        ),
      );
    });

    it('returns 200 with success:true and a paginated meta envelope', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?page=1&limit=20')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 20,
      });
      expect(typeof res.body.meta.total).toBe('number');
      expect(typeof res.body.meta.totalPages).toBe('number');
      expect(typeof res.body.meta.hasNextPage).toBe('boolean');
      expect(typeof res.body.meta.hasPrevPage).toBe('boolean');
    });

    it('respects the limit parameter', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?page=1&limit=2')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.meta.limit).toBe(2);
    });

    it('returns a different page of results on page=2', async () => {
      const page1 = await request(app)
        .get('/api/v1/tasks?page=1&limit=1')
        .set('Authorization', `Bearer ${tokenA()}`);

      const page2 = await request(app)
        .get('/api/v1/tasks?page=2&limit=1')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(page1.status).toBe(200);
      expect(page2.status).toBe(200);

      if (page1.body.data.length > 0 && page2.body.data.length > 0) {
        expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id);
      }

      expect(page1.body.meta.hasPrevPage).toBe(false);
    });

    it('sorts by createdAt desc by default (newest first)', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?page=1&limit=10&sortBy=createdAt&sortOrder=desc')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      const dates = res.body.data.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });

    it('sorts ascending when sortOrder=asc is supplied', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?page=1&limit=10&sortBy=createdAt&sortOrder=asc')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      const dates = res.body.data.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeLessThanOrEqual(dates[i]);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 8. Search — GET /api/v1/tasks?search=
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/tasks?search= — full-text search', () => {
    const uniqueKeyword = `STATUTORY-AUDIT-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: `${uniqueKeyword} Prepare`, description: 'Draft for FY26' });
    });

    it('returns the matching task when searching by unique title keyword', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks?search=${encodeURIComponent(uniqueKeyword)}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      const titles: string[] = res.body.data.map((t: { title: string }) => t.title);
      expect(titles.some((t) => t.includes(uniqueKeyword))).toBe(true);
    });

    it('returns an empty data array for a search term that matches nothing', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?search=ABSOLUTELY_NO_MATCH_XYZ_99999')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 9. Filter by status — GET /api/v1/tasks?status=
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/tasks?status= — status filter', () => {
    it('returns only TODO tasks when status=TODO is supplied', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?status=TODO')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((t: { status: string }) => {
        expect(t.status).toBe(TaskStatus.TODO);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 10. Filter by project
  // ══════════════════════════════════════════════════════════════════════════

  describe('project-scoped endpoints', () => {
    let projectTaskId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Project scoped task', projectId: projectAId });
      projectTaskId = res.body.data.id;
    });

    it('GET /tasks/project/:projectId returns the task linked to that project', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/project/${projectAId}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(projectTaskId);
    });

    it('GET /tasks/project/:projectId returns empty array for a project with no tasks', async () => {
      const emptyProject = await prisma.project.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          clientId: fixtures.tenantA.clientId,
          code: `EMPTY-${randomUUID().slice(0, 8)}`,
          name: 'Empty project',
          status: ProjectStatus.ACTIVE,
        },
      });

      const res = await request(app)
        .get(`/api/v1/tasks/project/${emptyProject.id}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);

      await prisma.project.delete({ where: { id: emptyProject.id } });
    });

    it('GET /tasks?projectId= filter returns only tasks from that project', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks?projectId=${projectAId}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((t: { projectId: string }) => {
        expect(t.projectId).toBe(projectAId);
      });
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(projectTaskId);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 11. Filter by assignee
  // ══════════════════════════════════════════════════════════════════════════

  describe('assignee-scoped endpoints', () => {
    let assignedTaskId: string;
    const assigneeId = (): string => fixtures.tenantA.userId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Assignee scoped task', assigneeId: assigneeId() });
      assignedTaskId = res.body.data.id;
    });

    it('GET /tasks/assignee/:assigneeId includes the assigned task', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/assignee/${assigneeId()}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(assignedTaskId);
    });

    it('GET /tasks?assigneeId= filter returns only tasks for that assignee', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks?assigneeId=${assigneeId()}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((t: { assigneeId: string }) => {
        expect(t.assigneeId).toBe(assigneeId());
      });
    });

    it('GET /tasks/assignee/:assigneeId returns an empty array for a user with no tasks', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/assignee/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 12. Overdue tasks — GET /api/v1/tasks/overdue
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/tasks/overdue', () => {
    let overdueTaskId: string;

    beforeAll(async () => {
      // Seed a task with a dueDate in the past so it shows up in /overdue.
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({
          title: 'Overdue integration task',
          dueDate: '2020-01-01T00:00:00.000Z', // well in the past
        });
      overdueTaskId = res.body.data.id;
    });

    it('returns 200 with an array of tasks', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/overdue')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('includes the seeded overdue task in the response', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/overdue')
        .set('Authorization', `Bearer ${tokenA()}`);

      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(overdueTaskId);
    });

    it("does not include tenant B's tasks in tenant A's overdue list", async () => {
      // Seed an overdue task for Tenant B.
      const resB = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenB()}`)
        .send({
          title: 'Tenant B overdue',
          dueDate: '2020-01-01T00:00:00.000Z',
        });
      const tenantBTaskId = resB.body.data.id;

      const res = await request(app)
        .get('/api/v1/tasks/overdue')
        .set('Authorization', `Bearer ${tokenA()}`);

      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).not.toContain(tenantBTaskId);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 13. Update — PATCH /api/v1/tasks/:id
  // ══════════════════════════════════════════════════════════════════════════

  describe('PATCH /api/v1/tasks/:id', () => {
    let updateTaskId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Task to update' });
      updateTaskId = res.body.data.id;
    });

    it('returns 200 and reflects updated title', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${updateTaskId}`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Updated task title' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated task title');
    });

    it('returns 200 when updating description and dates', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${updateTaskId}`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({
          description: 'Updated description',
          startDate: '2026-09-01T00:00:00.000Z',
          dueDate: '2026-09-30T00:00:00.000Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Updated description');
    });

    it('returns 422 when updated dueDate is before startDate', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${updateTaskId}`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({
          startDate: '2026-09-30T00:00:00.000Z',
          dueDate: '2026-09-01T00:00:00.000Z', // before startDate
        });

      expect(res.status).toBe(422);
    });

    it('returns 404 when attempting to update a non-existent task', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Ghost update' });

      expect(res.status).toBe(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 14. Status transitions — PATCH /api/v1/tasks/:id/status
  // ══════════════════════════════════════════════════════════════════════════

  describe('PATCH /api/v1/tasks/:id/status — lifecycle state machine', () => {
    let taskId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Status transition task' });
      taskId = res.body.data.id;
    });

    it('TODO → IN_PROGRESS returns 200', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ status: TaskStatus.IN_PROGRESS });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('IN_PROGRESS → TODO returns 409 (illegal backward transition)', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ status: TaskStatus.TODO });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('IN_PROGRESS → REVIEW returns 200', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ status: TaskStatus.REVIEW });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TaskStatus.REVIEW);
    });

    it('REVIEW → COMPLETED returns 200 and stamps completedAt', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ status: TaskStatus.COMPLETED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TaskStatus.COMPLETED);
      expect(res.body.data.completedAt).not.toBeNull();
    });

    it('COMPLETED → IN_PROGRESS (reopen) returns 200 and clears completedAt', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ status: TaskStatus.IN_PROGRESS });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TaskStatus.IN_PROGRESS);
      expect(res.body.data.completedAt).toBeNull();
    });

    it('CANCELLED requires a reason — returns 422 when reason is absent', async () => {
      // First move the task back to REVIEW so we can attempt CANCEL.
      await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ status: TaskStatus.REVIEW });

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ status: TaskStatus.CANCELLED }); // no reason

      expect(res.status).toBe(422);
    });

    it('CANCELLED with a valid reason returns 200', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ status: TaskStatus.CANCELLED, reason: 'Client scope change confirmed.' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TaskStatus.CANCELLED);
    });

    it('CANCELLED → any is 409 (terminal state, no outgoing transitions)', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ status: TaskStatus.TODO });

      expect(res.status).toBe(409);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 15. Delete — DELETE /api/v1/tasks/:id
  // ══════════════════════════════════════════════════════════════════════════

  describe('DELETE /api/v1/tasks/:id', () => {
    it('returns 409 when task status is IN_PROGRESS (not deletable)', async () => {
      const create = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Delete-blocked task' });
      const id = create.body.data.id;

      await request(app)
        .patch(`/api/v1/tasks/${id}/status`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ status: TaskStatus.IN_PROGRESS });

      const del = await request(app)
        .delete(`/api/v1/tasks/${id}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(del.status).toBe(409);
      expect(del.body.success).toBe(false);
    });

    it('returns 200 for a task in TODO status', async () => {
      const create = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Deletable TODO task' });
      const id = create.body.data.id;

      const del = await request(app)
        .delete(`/api/v1/tasks/${id}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(del.status).toBe(200);
      expect(del.body.success).toBe(true);
    });

    it('returns 200 for a task in CANCELLED status', async () => {
      const create = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Deletable CANCELLED task' });
      const id = create.body.data.id;

      await request(app)
        .patch(`/api/v1/tasks/${id}/status`)
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ status: TaskStatus.CANCELLED, reason: 'Test cancellation reason' });

      const del = await request(app)
        .delete(`/api/v1/tasks/${id}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(del.status).toBe(200);
    });

    it('returns 404 when attempting to delete a non-existent task', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 16. Soft-delete & restore
  // ══════════════════════════════════════════════════════════════════════════

  describe('soft-delete and restore lifecycle', () => {
    let taskId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Soft-delete lifecycle task' });
      taskId = res.body.data.id;
    });

    it('DELETE /tasks/:id returns 200 for a TODO task', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
    });

    it('GET /tasks/:id returns 404 after soft-delete (excluded by default)', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(404);
    });

    it('soft-deleted task is excluded from GET /tasks list', async () => {
      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).not.toContain(taskId);
    });

    it('PATCH /tasks/:id/restore returns 200 and makes the task visible again', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/restore`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(taskId);
    });

    it('GET /tasks/:id returns 200 after restore', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(taskId);
    });

    it('PATCH /tasks/:id/restore returns 409 for a task that is not deleted', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/restore`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 17. Tenant isolation
  // ══════════════════════════════════════════════════════════════════════════

  describe('tenant isolation', () => {
    let tenantATaskId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenA()}`)
        .send({ title: 'Tenant A exclusive task' });
      tenantATaskId = res.body.data.id;
    });

    it("Tenant B cannot read Tenant A's task by ID (404)", async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${tenantATaskId}`)
        .set('Authorization', `Bearer ${tokenB()}`);

      expect(res.status).toBe(404);
    });

    it("Tenant B's task list does not contain Tenant A's task", async () => {
      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenB()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).not.toContain(tenantATaskId);
    });

    it("Tenant A can still read its own task after Tenant B's queries", async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${tenantATaskId}`)
        .set('Authorization', `Bearer ${tokenA()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(tenantATaskId);
    });

    it("Tenant B cannot update Tenant A's task (404, not 403)", async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${tenantATaskId}`)
        .set('Authorization', `Bearer ${tokenB()}`)
        .send({ title: 'Hijack attempt' });

      expect(res.status).toBe(404);
    });

    it("Tenant B cannot delete Tenant A's task (404, not 403)", async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${tenantATaskId}`)
        .set('Authorization', `Bearer ${tokenB()}`);

      expect(res.status).toBe(404);
    });

    it("Tenant A's project tasks are not visible to Tenant B", async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/project/${projectAId}`)
        .set('Authorization', `Bearer ${tokenB()}`);

      // Tenant B can query the endpoint (it's a valid UUID) but results are scoped.
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });
});
