import { Task, TaskStatus } from '@prisma/client';
import { TaskResponseDto } from '../dto/task.res.dto';

/** Statuses that no longer count as "open"/overdue-eligible work. */
const TERMINAL_STATUSES: TaskStatus[] = [TaskStatus.COMPLETED, TaskStatus.CANCELLED];

/**
 * Entity ⇄ DTO mapper for `Task`. Services/controllers must always return
 * data through this mapper — never serialize a raw Prisma `Task` in a
 * response. Mirrors `modules/projects/mapper/project.mapper.ts`.
 *
 * TODO: once labels/milestones/subtasks/dependencies/time-tracking/comments/
 * attachments exist, `toResponseDto` gains the corresponding derived/joined
 * fields — none of those are computed here yet.
 */
export class TaskMapper {
  static toResponseDto(task: Task): TaskResponseDto {
    const isCompleted = task.status === TaskStatus.COMPLETED;
    const isOverdue =
      !!task.dueDate && task.dueDate.getTime() < Date.now() && !TERMINAL_STATUSES.includes(task.status);

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      type: task.type,
      priority: task.priority,
      projectId: task.projectId,
      leadId: task.leadId,
      assigneeId: task.assigneeId,
      createdBy: task.createdBy,
      businessId: task.businessId,
      contactId: task.contactId,
      clientId: task.clientId,
      documentId: task.documentId,
      folderId: task.folderId,
      startDate: task.startDate ? task.startDate.toISOString() : null,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      completedBy: task.completedBy,
      approvedBy: task.approvedBy,
      rejectedBy: task.rejectedBy,
      isOverdue,
      isCompleted,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(tasks: Task[]): TaskResponseDto[] {
    return tasks.map((task) => this.toResponseDto(task));
  }
}
