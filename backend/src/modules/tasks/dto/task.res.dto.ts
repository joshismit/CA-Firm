import { TaskStatus, TaskType, TaskPriority } from '@prisma/client';

/**
 * Response DTO — the shape returned to API clients.
 * Deliberately omits internal-only fields (`tenantId`, `deletedAt`,
 * `deletedBy`) that have no value outside the server; dates are serialised
 * to ISO strings rather than leaking Prisma `Date` objects. `createdBy` IS
 * exposed (unlike the other internal fields) — a client viewing a list of
 * their own firm's tasks needs to distinguish who created each one. Mirrors
 * `modules/projects/dto/project.res.dto.ts`.
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
  /** PRD §9 — null on tasks created without a type (simple TODO-based flow). */
  type: TaskType | null;
  priority: TaskPriority | null;
  projectId: string | null;
  leadId: string | null;
  assigneeId: string | null;
  createdBy: string | null;
  businessId: string | null;
  contactId: string | null;
  clientId: string | null;
  documentId: string | null;
  folderId: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
  approvedBy: string | null;
  rejectedBy: string | null;
  /** Computed: true if dueDate has passed and status is not a terminal status. */
  isOverdue: boolean;
  /** Computed: true if status is COMPLETED. */
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}
