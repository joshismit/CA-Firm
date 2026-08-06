import { TaskTemplate } from '@prisma/client';
import { TaskTemplateResponseDto } from '../dto/task-template.res.dto';

/**
 * Entity ⇄ DTO mapper for `TaskTemplate`. Services/controllers must always
 * return data through this mapper — never serialize a raw Prisma row.
 * Mirrors `modules/tasks/mapper/task.mapper.ts`.
 */
export class TaskTemplateMapper {
  static toResponseDto(template: TaskTemplate): TaskTemplateResponseDto {
    return {
      id: template.id,
      name: template.name,
      type: template.type,
      titleTemplate: template.titleTemplate,
      descriptionTemplate: template.descriptionTemplate,
      defaultPriority: template.defaultPriority,
      dueInDays: template.dueInDays,
      isActive: template.isActive,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(templates: TaskTemplate[]): TaskTemplateResponseDto[] {
    return templates.map((template) => this.toResponseDto(template));
  }
}
