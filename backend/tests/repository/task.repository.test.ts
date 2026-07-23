import { randomUUID } from 'crypto';
import { TaskStatus, TenantStatus, BusinessStatus, ClientStatus } from '@prisma/client';
import { prisma, disconnectDatabase } from '@config/database';
import { TaskRepository } from '@modules/tasks/repository/task.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TaskRepository Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises TaskRepository against a live database with real Prisma operations.
 * Tests tenant isolation, soft-delete filtering, paginated search, date ranges,
 * sorting, and count methods.
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('TaskRepository', () => {
  let repository: TaskRepository;

  // Tenant A Context
  let tenantAId: string;
  let userAId: string;
  let userA2Id: string;
  let projectA1Id: string;
  let projectA2Id: string;

  // Tenant B Context (for isolation checks)
  let tenantBId: string;
  let userBId: string;

  beforeAll(async () => {
    repository = new TaskRepository(prisma);

    const suffix = randomUUID().slice(0, 8);

    // ── Setup Tenant A ───────────────────────────────────────────────────────
    const tenantA = await prisma.tenant.create({
      data: {
        slug: `repo-test-a-${suffix}`,
        name: `Repo Test Tenant A ${suffix}`,
        status: TenantStatus.ACTIVE,
      },
    });
    tenantAId = tenantA.id;

    const userA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: `repo.usera.${suffix}@example.test`,
        firstName: 'User',
        lastName: 'A',
      },
    });
    userAId = userA.id;

    const userA2 = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: `repo.usera2.${suffix}@example.test`,
        firstName: 'User',
        lastName: 'A2',
      },
    });
    userA2Id = userA2.id;

    const bizTypeA = await prisma.businessType.create({
      data: {
        code: `BIZ-A-${suffix}`,
        name: `Biz Type A ${suffix}`,
      },
    });

    const bizA = await prisma.business.create({
      data: {
        tenantId: tenantAId,
        typeId: bizTypeA.id,
        name: `Biz A ${suffix}`,
        status: BusinessStatus.ACTIVE,
      },
    });

    const clientA = await prisma.client.create({
      data: {
        tenantId: tenantAId,
        businessId: bizA.id,
        status: ClientStatus.ACTIVE,
      },
    });

    const projA1 = await prisma.project.create({
      data: {
        tenantId: tenantAId,
        clientId: clientA.id,
        code: `PRJ-A1-${suffix}`,
        name: `Project A1 ${suffix}`,
      },
    });
    projectA1Id = projA1.id;

    const projA2 = await prisma.project.create({
      data: {
        tenantId: tenantAId,
        clientId: clientA.id,
        code: `PRJ-A2-${suffix}`,
        name: `Project A2 ${suffix}`,
      },
    });
    projectA2Id = projA2.id;

    // ── Setup Tenant B ───────────────────────────────────────────────────────
    const tenantB = await prisma.tenant.create({
      data: {
        slug: `repo-test-b-${suffix}`,
        name: `Repo Test Tenant B ${suffix}`,
        status: TenantStatus.ACTIVE,
      },
    });
    tenantBId = tenantB.id;

    const userB = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        email: `repo.userb.${suffix}@example.test`,
        firstName: 'User',
        lastName: 'B',
      },
    });
    userBId = userB.id;
  });

  afterAll(async () => {
    const tenantIds = [tenantAId, tenantBId].filter((id): id is string => Boolean(id));
    if (tenantIds.length === 0) return;

    await prisma.task.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.project.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.client.deleteMany({ where: { tenantId: { in: tenantIds } } });

    const businesses = await prisma.business.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true, typeId: true },
    });
    await prisma.business.deleteMany({ where: { tenantId: { in: tenantIds } } });
    const typeIds = businesses.map((b) => b.typeId).filter((id): id is string => Boolean(id));
    if (typeIds.length > 0) {
      await prisma.businessType.deleteMany({ where: { id: { in: typeIds } } });
    }

    await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await disconnectDatabase();
  });

  describe('create() and findById()', () => {
    it('should create a task scoped to a tenant and retrieve it by ID', async () => {
      const task = await repository.create(
        {
          title: 'Prepare Audit Report',
          description: 'Draft initial audit findings',
          status: TaskStatus.TODO,
          projectId: projectA1Id,
          assigneeId: userAId,
          createdBy: userAId,
        },
        { tenantId: tenantAId },
      );

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.title).toBe('Prepare Audit Report');
      expect(task.tenantId).toBe(tenantAId);
      expect(task.projectId).toBe(projectA1Id);
      expect(task.assigneeId).toBe(userAId);
      expect(task.status).toBe(TaskStatus.TODO);

      const found = await repository.findById(task.id, { tenantId: tenantAId });
      expect(found).toBeDefined();
      expect(found?.id).toBe(task.id);
      expect(found?.title).toBe('Prepare Audit Report');
    });

    it('should enforce tenant isolation on findById', async () => {
      const taskA = await repository.create(
        {
          title: 'Tenant A Isolated Task',
          status: TaskStatus.TODO,
        },
        { tenantId: tenantAId },
      );

      // Querying with Tenant B options should return null
      const foundInTenantB = await repository.findById(taskA.id, { tenantId: tenantBId });
      expect(foundInTenantB).toBeNull();
    });
  });

  describe('findByProject()', () => {
    it('should find all tasks belonging to a specific project ordered by createdAt desc', async () => {
      const task1 = await repository.create(
        { title: 'Project Task 1', projectId: projectA1Id, status: TaskStatus.TODO },
        { tenantId: tenantAId },
      );
      const task2 = await repository.create(
        { title: 'Project Task 2', projectId: projectA1Id, status: TaskStatus.IN_PROGRESS },
        { tenantId: tenantAId },
      );
      // Different project
      await repository.create(
        { title: 'Project 2 Task', projectId: projectA2Id, status: TaskStatus.TODO },
        { tenantId: tenantAId },
      );

      const tasks = await repository.findByProject(projectA1Id, { tenantId: tenantAId });
      const taskIds = tasks.map((t) => t.id);

      expect(tasks.length).toBeGreaterThanOrEqual(2);
      expect(taskIds).toContain(task1.id);
      expect(taskIds).toContain(task2.id);
      expect(taskIds).not.toContain(projectA2Id);

      // Verify all returned tasks belong to projectA1Id
      expect(tasks.every((t) => t.projectId === projectA1Id)).toBe(true);
    });

    it('should enforce tenant isolation on findByProject', async () => {
      const tasks = await repository.findByProject(projectA1Id, { tenantId: tenantBId });
      expect(tasks).toHaveLength(0);
    });
  });

  describe('findByAssignee()', () => {
    it('should find all tasks assigned to a specific user', async () => {
      const task1 = await repository.create(
        { title: 'Assignee Task 1', assigneeId: userA2Id, status: TaskStatus.TODO },
        { tenantId: tenantAId },
      );
      const task2 = await repository.create(
        { title: 'Assignee Task 2', assigneeId: userA2Id, status: TaskStatus.REVIEW },
        { tenantId: tenantAId },
      );

      const tasks = await repository.findByAssignee(userA2Id, { tenantId: tenantAId });
      const taskIds = tasks.map((t) => t.id);

      expect(tasks.length).toBeGreaterThanOrEqual(2);
      expect(taskIds).toContain(task1.id);
      expect(taskIds).toContain(task2.id);
      expect(tasks.every((t) => t.assigneeId === userA2Id)).toBe(true);
    });

    it('should enforce tenant isolation on findByAssignee', async () => {
      const tasks = await repository.findByAssignee(userA2Id, { tenantId: tenantBId });
      expect(tasks).toHaveLength(0);
    });
  });

  describe('findOverdue()', () => {
    it('should find non-terminal tasks whose due date has passed', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day future

      // Overdue open task
      const overdueTask = await repository.create(
        {
          title: 'Overdue Pending Task',
          status: TaskStatus.IN_PROGRESS,
          dueDate: pastDate,
        },
        { tenantId: tenantAId },
      );

      // Future due task (not overdue)
      const futureTask = await repository.create(
        {
          title: 'Future Task',
          status: TaskStatus.TODO,
          dueDate: futureDate,
        },
        { tenantId: tenantAId },
      );

      // Completed task past due date (terminal - should NOT be included in overdue)
      const completedTask = await repository.create(
        {
          title: 'Completed Past Task',
          status: TaskStatus.COMPLETED,
          dueDate: pastDate,
          completedAt: new Date(),
        },
        { tenantId: tenantAId },
      );

      const overdueList = await repository.findOverdue({ tenantId: tenantAId });
      const overdueIds = overdueList.map((t) => t.id);

      expect(overdueIds).toContain(overdueTask.id);
      expect(overdueIds).not.toContain(futureTask.id);
      expect(overdueIds).not.toContain(completedTask.id);
    });
  });

  describe('search() with filters, pagination, and sorting', () => {
    it('should filter by search term, status, project, assignee, and paginate', async () => {
      const searchKey = randomUUID().slice(0, 6);

      await repository.create(
        {
          title: `Tax Filing ${searchKey}`,
          description: 'Quarterly GST Filing',
          status: TaskStatus.TODO,
          projectId: projectA1Id,
        },
        { tenantId: tenantAId },
      );

      await repository.create(
        {
          title: `IT Return ${searchKey}`,
          description: 'Income Tax Computation',
          status: TaskStatus.IN_PROGRESS,
          projectId: projectA1Id,
        },
        { tenantId: tenantAId },
      );

      // Search matching title/description
      const searchResult = await repository.search(
        { search: searchKey },
        { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: tenantAId },
      );

      expect(searchResult.data).toHaveLength(2);
      expect(searchResult.meta.total).toBe(2);
      expect(searchResult.meta.page).toBe(1);
      expect(searchResult.meta.totalPages).toBe(1);
      expect(searchResult.meta.hasNextPage).toBe(false);

      // Filter with status
      const statusFiltered = await repository.search(
        { search: searchKey, status: TaskStatus.TODO },
        { page: 1, limit: 10 },
        { tenantId: tenantAId },
      );
      expect(statusFiltered.data).toHaveLength(1);
      expect(statusFiltered.data[0].status).toBe(TaskStatus.TODO);
    });

    it('should filter by dueBefore and dueAfter date ranges', async () => {
      const dateKey = randomUUID().slice(0, 6);
      const targetDate = new Date('2026-06-15T00:00:00.000Z');

      const task = await repository.create(
        {
          title: `Scheduled Task ${dateKey}`,
          status: TaskStatus.TODO,
          dueDate: targetDate,
        },
        { tenantId: tenantAId },
      );

      const rangeResult = await repository.search(
        {
          search: dateKey,
          dueAfter: new Date('2026-06-01T00:00:00.000Z'),
          dueBefore: new Date('2026-06-30T00:00:00.000Z'),
        },
        { page: 1, limit: 10 },
        { tenantId: tenantAId },
      );

      expect(rangeResult.data).toHaveLength(1);
      expect(rangeResult.data[0].id).toBe(task.id);
    });
  });

  describe('countByStatus() and countByProject()', () => {
    it('should accurately count tasks by status', async () => {
      const countKey = randomUUID().slice(0, 6);

      await repository.create(
        { title: `Count Status 1 ${countKey}`, status: TaskStatus.REVIEW },
        { tenantId: tenantAId },
      );
      await repository.create(
        { title: `Count Status 2 ${countKey}`, status: TaskStatus.REVIEW },
        { tenantId: tenantAId },
      );

      const count = await repository.countByStatus(TaskStatus.REVIEW, { tenantId: tenantAId });
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should accurately count tasks by project', async () => {
      const projectCount = await repository.countByProject(projectA1Id, { tenantId: tenantAId });
      expect(projectCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('soft delete filtering and restore', () => {
    it('should soft-delete a task and exclude it from default queries, unless ignoreSoftDelete is true', async () => {
      const task = await repository.create(
        { title: 'Task to be Soft Deleted', status: TaskStatus.TODO },
        { tenantId: tenantAId },
      );

      // Soft delete
      await repository.delete(task.id, { tenantId: tenantAId, userId: userAId });

      // Default findById should return null
      const findDeleted = await repository.findById(task.id, { tenantId: tenantAId });
      expect(findDeleted).toBeNull();

      // With ignoreSoftDelete: true, it should return the record with deletedAt set
      const findIgnored = await repository.findById(task.id, {
        tenantId: tenantAId,
        ignoreSoftDelete: true,
      });
      expect(findIgnored).toBeDefined();
      expect(findIgnored?.deletedAt).not.toBeNull();
      expect(findIgnored?.deletedBy).toBe(userAId);

      // Restore task
      await repository.restore(task.id, { tenantId: tenantAId });

      // Should now be visible again via standard findById
      const restored = await repository.findById(task.id, { tenantId: tenantAId });
      expect(restored).toBeDefined();
      expect(restored?.deletedAt).toBeNull();
    });
  });
});
