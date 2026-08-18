import { TaskType, TaskPriority } from '@prisma/client';

/**
 * Response DTO — the shape returned to API clients. Deliberately omits
 * internal-only fields (`tenantId`, `deletedAt`, `deletedBy`, `createdBy`).
 * Mirrors `modules/tasks/dto/task.res.dto.ts`.
 */
export interface TaskTemplateResponseDto {
  id: string;
  name: string;
  type: TaskType;
  titleTemplate: string;
  descriptionTemplate: string | null;
  defaultPriority: TaskPriority | null;
  dueInDays: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
