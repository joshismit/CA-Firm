import { Request } from 'express';
import { Project, ProjectStatus } from '@prisma/client';

/**
 * `ProjectService`'s constructor defaults to `new ProjectRepository(prisma)`
 * (the real `@config/database` singleton) when no repository is injected.
 * These tests always inject an explicit mock repository, so the real
 * `prisma` export is never used — but merely *importing* `ProjectService`
 * transitively imports `@config/database`, whose top-level `new
 * PrismaClient(...)` call currently throws at construction time (pre-existing
 * issue: Prisma 7's "client" engine requires a driver adapter that isn't
 * wired up anywhere in this codebase yet — reproduced independently outside
 * this test suite). Stubbing the module here is test-only and does not touch
 * production code.
 */
jest.mock('@config/database', () => ({ prisma: {} }));
import { UserRole } from '@shared/enums';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';
import { ProjectService } from '@modules/projects/service/project.service';
import { ProjectRepository } from '@modules/projects/repository/project.repository';
import {
  CreateProjectDto,
  ListProjectsQueryDto,
  UpdateProjectStatusDto,
} from '@modules/projects/dto/project.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ProjectService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `ProjectRepository` is fully mocked — these tests exercise only the
 * business logic in `ProjectService` (guards, transitions, cross-field
 * validation), never a real database. The repository mock is injected via
 * the service's constructor DI parameter, exactly as designed for this.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

type MockedProjectRepository = {
  [K in
    | 'findByCode'
    | 'findById'
    | 'create'
    | 'update'
    | 'delete'
    | 'restore'
    | 'findMany'
    | 'findByClient'
    | 'findOverdue'
    | 'search']: jest.Mock;
};

function createMockRepository(): MockedProjectRepository {
  return {
    findByCode: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
    findMany: jest.fn(),
    findByClient: jest.fn(),
    findOverdue: jest.fn(),
    search: jest.fn(),
  };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'manager@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockProject(overrides: Partial<Project> = {}): Project {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'project-33333333-3333-3333-3333-333333333333',
    tenantId: TENANT_ID,
    clientId: 'client-44444444-4444-4444-4444-444444444444',
    managerId: null,
    code: 'AUD-2026-001',
    name: 'FY26 Statutory Audit',
    status: ProjectStatus.DRAFT,
    startDate: null,
    dueDate: null,
    completedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: USER_ID,
    deletedBy: null,
    ...overrides,
  };
}

function createService(repository: MockedProjectRepository): ProjectService {
  return new ProjectService(createFakeRequest(), repository as unknown as ProjectRepository);
}

describe('ProjectService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // createProject
  // ────────────────────────────────────────────────────────────────────────
  describe('createProject', () => {
    const dto: CreateProjectDto = {
      clientId: 'client-44444444-4444-4444-4444-444444444444',
      code: 'AUD-2026-001',
      name: 'FY26 Statutory Audit',
    };

    it('creates a project in DRAFT status when the code is unique', async () => {
      const repo = createMockRepository();
      repo.findByCode.mockResolvedValue(null);
      const created = createMockProject();
      repo.create.mockResolvedValue(created);

      const service = createService(repo);
      const result = await service.createProject(dto);

      expect(repo.findByCode).toHaveBeenCalledWith(dto.code, { tenantId: TENANT_ID });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: dto.clientId,
          code: dto.code,
          name: dto.name,
          managerId: null,
          startDate: null,
          dueDate: null,
          status: ProjectStatus.DRAFT,
          createdBy: USER_ID,
        }),
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });

    it('throws ConflictError when a project with the same code already exists (duplicate code)', async () => {
      const repo = createMockRepository();
      repo.findByCode.mockResolvedValue(createMockProject({ code: dto.code }));

      const service = createService(repo);

      await expect(service.createProject(dto)).rejects.toThrow(ConflictError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws ValidationError when dueDate is before startDate (invalid date range)', async () => {
      const repo = createMockRepository();
      const invalidDto: CreateProjectDto = {
        ...dto,
        startDate: new Date('2026-03-01'),
        dueDate: new Date('2026-02-01'),
      };

      const service = createService(repo);

      await expect(service.createProject(invalidDto)).rejects.toThrow(ValidationError);
      // The date-range guard runs before any repository access.
      expect(repo.findByCode).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateProjectStatus — invalid status transition
  // ────────────────────────────────────────────────────────────────────────
  describe('updateProjectStatus', () => {
    it('throws ConflictError for a transition the state machine does not allow (invalid status transition)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockProject({ status: ProjectStatus.DRAFT }));

      const service = createService(repo);
      const dto: UpdateProjectStatusDto = { status: ProjectStatus.COMPLETED };

      // DRAFT can only move to PLANNED or CANCELLED — COMPLETED is illegal here.
      await expect(service.updateProjectStatus('project-1', dto)).rejects.toThrow(ConflictError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws ConflictError when the project is ARCHIVED, regardless of target status', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockProject({ status: ProjectStatus.ARCHIVED }));

      const service = createService(repo);

      await expect(
        service.updateProjectStatus('project-1', { status: ProjectStatus.ACTIVE }),
      ).rejects.toThrow(ConflictError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws ValidationError when moving to ON_HOLD without a reason', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockProject({ status: ProjectStatus.ACTIVE }));

      const service = createService(repo);

      await expect(
        service.updateProjectStatus('project-1', { status: ProjectStatus.ON_HOLD }),
      ).rejects.toThrow(ValidationError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('allows a legal transition and sets completedAt when moving to COMPLETED', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockProject({ status: ProjectStatus.ACTIVE }));
      const updated = createMockProject({ status: ProjectStatus.COMPLETED });
      repo.update.mockResolvedValue(updated);

      const service = createService(repo);
      const result = await service.updateProjectStatus('project-1', {
        status: ProjectStatus.COMPLETED,
      });

      expect(repo.update).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ status: ProjectStatus.COMPLETED, completedAt: expect.any(Date) }),
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(updated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // archiveProject — archive validation
  // ────────────────────────────────────────────────────────────────────────
  describe('archiveProject', () => {
    it('throws NotFoundError when the project does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.archiveProject('missing-id')).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when the project is not COMPLETED', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockProject({ status: ProjectStatus.ACTIVE }));

      const service = createService(repo);

      await expect(service.archiveProject('project-1')).rejects.toThrow(ConflictError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('archives a COMPLETED project, setting ARCHIVED status and archivedAt', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockProject({ status: ProjectStatus.COMPLETED }));
      const archived = createMockProject({ status: ProjectStatus.ARCHIVED, archivedAt: new Date() });
      repo.update.mockResolvedValue(archived);

      const service = createService(repo);
      const result = await service.archiveProject('project-1');

      expect(repo.update).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ status: ProjectStatus.ARCHIVED, archivedAt: expect.any(Date) }),
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(archived);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteProject — delete validation
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteProject', () => {
    it('throws NotFoundError when the project does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.deleteProject('missing-id')).rejects.toThrow(NotFoundError);
    });

    it.each([ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED])(
      'throws ConflictError when the project status is %s (not deletable)',
      async (status) => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockProject({ status }));

        const service = createService(repo);

        await expect(service.deleteProject('project-1')).rejects.toThrow(ConflictError);
        expect(repo.delete).not.toHaveBeenCalled();
      },
    );

    it('soft-deletes a project in DRAFT status', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockProject({ status: ProjectStatus.DRAFT }));
      repo.delete.mockResolvedValue(true);

      const service = createService(repo);
      await service.deleteProject('project-1');

      expect(repo.delete).toHaveBeenCalledWith('project-1', { tenantId: TENANT_ID, userId: USER_ID });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // restoreProject — restore validation
  // ────────────────────────────────────────────────────────────────────────
  describe('restoreProject', () => {
    it('throws NotFoundError when the project does not exist at all (including among deleted records)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.restoreProject('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.findById).toHaveBeenCalledWith('missing-id', {
        tenantId: TENANT_ID,
        ignoreSoftDelete: true,
      });
    });

    it('throws ConflictError when the project is not deleted', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockProject({ deletedAt: null }));

      const service = createService(repo);

      await expect(service.restoreProject('project-1')).rejects.toThrow(ConflictError);
      expect(repo.restore).not.toHaveBeenCalled();
    });

    it('restores a soft-deleted project', async () => {
      const repo = createMockRepository();
      const deletedProject = createMockProject({ deletedAt: new Date(), deletedBy: USER_ID });
      const restoredProject = createMockProject({ deletedAt: null, deletedBy: null });

      repo.findById
        .mockResolvedValueOnce(deletedProject) // initial lookup (ignoreSoftDelete: true)
        .mockResolvedValueOnce(restoredProject); // re-fetch after restore
      repo.restore.mockResolvedValue(true);

      const service = createService(repo);
      const result = await service.restoreProject('project-1');

      expect(repo.restore).toHaveBeenCalledWith('project-1', { tenantId: TENANT_ID });
      expect(result).toBe(restoredProject);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getProjectById
  // ────────────────────────────────────────────────────────────────────────
  describe('getProjectById', () => {
    it('returns the project when found', async () => {
      const repo = createMockRepository();
      const project = createMockProject();
      repo.findById.mockResolvedValue(project);

      const service = createService(repo);
      const result = await service.getProjectById(project.id);

      expect(repo.findById).toHaveBeenCalledWith(project.id, { tenantId: TENANT_ID });
      expect(result).toBe(project);
    });

    it('throws NotFoundError when no project matches the ID', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getProjectById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // listProjects
  // ────────────────────────────────────────────────────────────────────────
  describe('listProjects', () => {
    it('delegates to repository.search with the filters and pagination mapped from the query', async () => {
      const repo = createMockRepository();
      const projects = [createMockProject(), createMockProject({ id: 'project-2' })];
      const paginated = {
        data: projects,
        meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const query: ListProjectsQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'audit',
        status: ProjectStatus.ACTIVE,
        clientId: 'client-44444444-4444-4444-4444-444444444444',
      };

      const result = await service.listProjects(query);

      expect(repo.search).toHaveBeenCalledWith(
        {
          status: ProjectStatus.ACTIVE,
          clientId: 'client-44444444-4444-4444-4444-444444444444',
          managerId: undefined,
          dueBefore: undefined,
          dueAfter: undefined,
          search: 'audit',
        },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });
});
