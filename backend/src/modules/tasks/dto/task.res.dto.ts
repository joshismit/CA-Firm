import { TaskStatus } from '@prisma/client';

/**
 * Response DTO — the shape returned to API clients.
 * Deliberately omits internal-only fields (`tenantId`, `deletedAt`,
 * `deletedBy`, `createdBy`) that have no value outside the server; dates are
 * serialised to ISO strings rather than leaking Prisma `Date` objects.
 * Mirrors `modules/projects/dto/project.res.dto.ts`.
 *
 * TODO: once labels/milestones/subtasks/dependencies/time-tracking/comments/
 * attachments exist, this DTO gains corresponding fields (e.g. `labels: string[]`,
 * `milestoneId`, `subtaskCount`, `isBlocked`, `loggedMinutes`, `commentCount`,
 * `attachmentCount`) — none of those exist yet.
 */
export interface TaskResponseDto {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  projectId: string | null;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  /** Computed: true if dueDate has passed and status is not COMPLETED/CANCELLED. */
  isOverdue: boolean;
  /** Computed: true if status is COMPLETED. */
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}
