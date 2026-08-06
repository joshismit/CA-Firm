import request from 'supertest';
import { TaskStatus, TenantStatus } from '@prisma/client';
import { prisma, disconnectDatabase } from '@config/database';
import { createTaskTestApp } from '../integration/helpers/task-test-app';
import { signAccessToken } from '../integration/helpers/jwt';
import { TaskService } from '@modules/tasks/service/task.service';
import { TASK_PERMISSIONS } from '@modules/tasks/constants/task.permissions';
import { NotFoundError, ConflictError, ValidationError } from '@shared/errors';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TaskController Unit & Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mocks ONLY `TaskService` methods via Jest spies and `prisma.tenant.findUnique`
 * so `tenantMiddleware` succeeds without needing database fixtures. Exercises
 * the full HTTP request lifecycle: Auth, Tenant, Permission check, Zod Validation,
 * TaskController, and Error handling middleware.
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('TaskController', () => {
  const app = createTaskTestApp();

  const tenantId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const taskId = '33333333-3333-4333-8333-333333333333';
  const projectId = '44444444-4444-4444-8444-444444444444';
  const assigneeId = '55555555-5555-4555-8555-555555555555';

  // Helper token with full task permissions
  const fullPermissionToken = signAccessToken({
    userId,
    tenantId,
    permissions: Object.values(TASK_PERMISSIONS),
  });

  // Token without any task permissions
  const noPermissionToken = signAccessToken({
    userId,
    tenantId,
    permissions: [],
  });

  const mockTask = {
    id: taskId,
    tenantId,
    projectId,
    leadId: null,
    assigneeId,
    title: 'Prepare Statutory Audit',
    description: 'Draft financial statements',
    status: TaskStatus.TODO,
    type: null,
    priority: null,
    businessId: null,
    contactId: null,
    clientId: null,
    documentId: null,
    folderId: null,
    startDate: new Date('2026-06-01'),
    dueDate: new Date('2026-06-30'),
    completedAt: null,
    completedBy: null,
    approvedBy: null,
    rejectedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: userId,
    deletedBy: null,
  };

  beforeAll(() => {
    // Mock tenant resolution so tenantMiddleware passes without DB calls
    jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
      id: tenantId,
      slug: 'test-tenant',
      name: 'Test Tenant',
      planCode: 'PRO',
      status: TenantStatus.ACTIVE,
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Re-apply tenant mock after restore
    jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
      id: tenantId,
      slug: 'test-tenant',
      name: 'Test Tenant',
      planCode: 'PRO',
      status: TenantStatus.ACTIVE,
    } as any);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  // ─── 1. POST /api/v1/tasks (create) ────────────────────────────────────────

  describe('POST /api/v1/tasks', () => {
    it('should return 201 CREATED with ApiResponseHelper envelope when request is valid', async () => {
      jest.spyOn(TaskService.prototype, 'createTask').mockResolvedValue(mockTask);

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${fullPermissionToken}`)
        .send({
          title: 'Prepare Statutory Audit',
          projectId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(taskId);
      expect(res.body.data.title).toBe('Prepare Statutory Audit');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.correlationId).toBeDefined();
    });

    it('should return 401 Unauthorized when Authorization header is missing', async () => {
      const res = await request(app).post('/api/v1/tasks').send({ title: 'Task' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 Forbidden when caller lacks tasks:create permission', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${noPermissionToken}`)
        .send({ title: 'Task' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 422 Unprocessable Entity when Zod validation fails (title too short)', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${fullPermissionToken}`)
        .send({ title: 'A' }); // Minimum 2 characters

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should return 422 Unprocessable Entity when TaskService throws ValidationError', async () => {
      jest
        .spyOn(TaskService.prototype, 'createTask')
        .mockRejectedValue(new ValidationError('dueDate cannot be before startDate.'));

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${fullPermissionToken}`)
        .send({
          title: 'Prepare Statutory Audit',
          startDate: '2026-06-20T00:00:00.000Z',
          dueDate: '2026-06-10T00:00:00.000Z',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('dueDate cannot be before startDate.');
    });
  });

  // ─── 2. GET /api/v1/tasks (list) ───────────────────────────────────────────

  describe('GET /api/v1/tasks', () => {
    it('should return 200 OK with paginated envelope', async () => {
      const paginatedResult = {
        data: [mockTask],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };

      jest.spyOn(TaskService.prototype, 'listTasks').mockResolvedValue(paginatedResult);

      const res = await request(app)
        .get('/api/v1/tasks?page=1&limit=20&status=TODO')
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toEqual(paginatedResult.meta);
    });

    it('should return 422 Unprocessable Entity when query param is invalid (e.g. limit > 100)', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?limit=500')
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── 3. GET /api/v1/tasks/overdue (getOverdue) ─────────────────────────────

  describe('GET /api/v1/tasks/overdue', () => {
    it('should return 200 OK with overdue tasks list', async () => {
      jest.spyOn(TaskService.prototype, 'getOverdueTasks').mockResolvedValue([mockTask]);

      const res = await request(app)
        .get('/api/v1/tasks/overdue')
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── 4. GET /api/v1/tasks/project/:projectId (getByProject) ───────────────

  describe('GET /api/v1/tasks/project/:projectId', () => {
    it('should return 200 OK when projectId is valid UUID', async () => {
      jest.spyOn(TaskService.prototype, 'getTasksByProject').mockResolvedValue([mockTask]);

      const res = await request(app)
        .get(`/api/v1/tasks/project/${projectId}`)
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 422 Unprocessable Entity when projectId is not UUID', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/project/not-a-uuid')
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── 5. GET /api/v1/tasks/assignee/:assigneeId (getByAssignee) ─────────────

  describe('GET /api/v1/tasks/assignee/:assigneeId', () => {
    it('should return 200 OK when assigneeId is valid UUID', async () => {
      jest.spyOn(TaskService.prototype, 'getTasksByAssignee').mockResolvedValue([mockTask]);

      const res = await request(app)
        .get(`/api/v1/tasks/assignee/${assigneeId}`)
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 422 Unprocessable Entity when assigneeId is not UUID', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/assignee/invalid-uuid')
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(422);
    });
  });

  // ─── 6. GET /api/v1/tasks/:id (getById) ────────────────────────────────────

  describe('GET /api/v1/tasks/:id', () => {
    it('should return 200 OK when task exists', async () => {
      jest.spyOn(TaskService.prototype, 'getTaskById').mockResolvedValue(mockTask);

      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(taskId);
    });

    it('should return 404 Not Found when task does not exist', async () => {
      jest
        .spyOn(TaskService.prototype, 'getTaskById')
        .mockRejectedValue(new NotFoundError('Task'));

      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 422 Unprocessable Entity when id parameter is invalid UUID', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/123-bad-id')
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(422);
    });
  });

  // ─── 7. PATCH /api/v1/tasks/:id (update) ───────────────────────────────────

  describe('PATCH /api/v1/tasks/:id', () => {
    it('should return 200 OK when update succeeds', async () => {
      jest.spyOn(TaskService.prototype, 'updateTask').mockResolvedValue({
        ...mockTask,
        title: 'Updated Audit Task',
      });

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${fullPermissionToken}`)
        .send({ title: 'Updated Audit Task' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Audit Task');
    });

    it('should return 404 Not Found when task to update is missing', async () => {
      jest
        .spyOn(TaskService.prototype, 'updateTask')
        .mockRejectedValue(new NotFoundError('Task'));

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${fullPermissionToken}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  // ─── 8. PATCH /api/v1/tasks/:id/status (updateStatus) ───────────────────────

  describe('PATCH /api/v1/tasks/:id/status', () => {
    it('should return 200 OK when status transition is valid', async () => {
      jest.spyOn(TaskService.prototype, 'updateTaskStatus').mockResolvedValue({
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
      });

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${fullPermissionToken}`)
        .send({ status: TaskStatus.IN_PROGRESS });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should return 409 Conflict when status transition is invalid', async () => {
      jest
        .spyOn(TaskService.prototype, 'updateTaskStatus')
        .mockRejectedValue(
          new ConflictError('Cannot transition task from TODO to COMPLETED.'),
        );

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${fullPermissionToken}`)
        .send({ status: TaskStatus.COMPLETED });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Cannot transition task from TODO to COMPLETED.');
    });
  });

  // ─── 9. PATCH /api/v1/tasks/:id/restore (restore) ─────────────────────────

  describe('PATCH /api/v1/tasks/:id/restore', () => {
    it('should return 200 OK when task is restored', async () => {
      jest.spyOn(TaskService.prototype, 'restoreTask').mockResolvedValue(mockTask);

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/restore`)
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 409 Conflict when task is not deleted', async () => {
      jest
        .spyOn(TaskService.prototype, 'restoreTask')
        .mockRejectedValue(new ConflictError('Task is not deleted.'));

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/restore`)
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Task is not deleted.');
    });
  });

  // ─── 10. DELETE /api/v1/tasks/:id (delete) ─────────────────────────────────

  describe('DELETE /api/v1/tasks/:id', () => {
    it('should return 200 OK when deletion succeeds', async () => {
      jest.spyOn(TaskService.prototype, 'deleteTask').mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 409 Conflict when task status prevents deletion', async () => {
      jest
        .spyOn(TaskService.prototype, 'deleteTask')
        .mockRejectedValue(
          new ConflictError('Only TODO or CANCELLED tasks can be deleted.'),
        );

      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${fullPermissionToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });
});
