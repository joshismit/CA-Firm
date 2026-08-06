import { Request } from 'express';
import { Task, TaskTemplate } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError } from '@shared/errors';
import { PaginationMeta } from '@shared/types';
import { TaskTemplateRepository } from '../repository/task-template.repository';
import { TaskService } from './task.service';
import {
  CreateTaskTemplateDto,
  UpdateTaskTemplateDto,
  InstantiateTaskTemplateDto,
  ListTaskTemplatesQueryDto,
} from '../dto/task-template.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Template Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PRD §9 — reusable Task blueprints. `instantiate()` delegates to
 * `TaskService.createTask()` — the same cross-module composition style
 * `LeadService` already uses for `TaskService` (constructor DI, `new
 * TaskService(req)`) — so a template-created Task gets identical
 * notification/audit/permission handling to every other creation path. No
 * parallel task-creation logic exists here.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TaskTemplateService extends BaseService {
  constructor(
    req: Request,
    private readonly taskTemplateRepository: TaskTemplateRepository = new TaskTemplateRepository(prisma),
    private readonly taskService: TaskService = new TaskService(req),
  ) {
    super(req);
  }

  async createTemplate(dto: CreateTaskTemplateDto): Promise<TaskTemplate> {
    this.logger.info({ name: dto.name, type: dto.type }, 'Creating task template');

    return this.taskTemplateRepository.create(
      {
        name: dto.name,
        type: dto.type,
        titleTemplate: dto.titleTemplate,
        descriptionTemplate: dto.descriptionTemplate ?? null,
        defaultPriority: dto.defaultPriority ?? null,
        dueInDays: dto.dueInDays ?? null,
        createdBy: this.userId ?? null,
      },
      { tenantId: this.tenantId },
    );
  }

  async updateTemplate(id: string, dto: UpdateTaskTemplateDto): Promise<TaskTemplate> {
    const existing = await this.taskTemplateRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'TaskTemplate');

    this.logger.info({ templateId: id }, 'Updating task template');

    return this.taskTemplateRepository.update(id, dto, { tenantId: this.tenantId });
  }

  async deleteTemplate(id: string): Promise<void> {
    const existing = await this.taskTemplateRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'TaskTemplate');

    this.logger.info({ templateId: id }, 'Deleting task template');

    await this.taskTemplateRepository.delete(id, { tenantId: this.tenantId, userId: this.userId });
  }

  async getTemplateById(id: string): Promise<TaskTemplate> {
    const template = await this.taskTemplateRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(template, 'TaskTemplate');
    return template;
  }

  async listTemplates(
    query: ListTaskTemplatesQueryDto,
  ): Promise<{ data: TaskTemplate[]; meta: PaginationMeta }> {
    return this.taskTemplateRepository.search(
      {
        type: query.type,
        isActive: query.isActive,
        search: query.search,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      { tenantId: this.tenantId },
    );
  }

  /**
   * Creates a real `Task` from this template — see this class's header
   * comment for why it delegates to `TaskService.createTask()` instead of
   * writing task rows directly.
   */
  async instantiate(id: string, dto: InstantiateTaskTemplateDto): Promise<Task> {
    const template = await this.taskTemplateRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(template, 'TaskTemplate');

    if (!template.isActive) {
      throw new ConflictError('Cannot instantiate an inactive template.');
    }

    const dueDate =
      dto.dueDate ??
      (template.dueInDays != null
        ? new Date(Date.now() + template.dueInDays * 24 * 60 * 60 * 1000)
        : undefined);

    return this.taskService.createTask({
      title: dto.title ?? template.titleTemplate,
      description: dto.description ?? template.descriptionTemplate ?? undefined,
      type: template.type,
      priority: dto.priority ?? template.defaultPriority ?? undefined,
      projectId: dto.projectId,
      leadId: dto.leadId,
      assigneeId: dto.assigneeId,
      businessId: dto.businessId,
      contactId: dto.contactId,
      clientId: dto.clientId,
      dueDate,
    });
  }
}
