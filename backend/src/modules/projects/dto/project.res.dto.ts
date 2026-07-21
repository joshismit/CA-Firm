import { ProjectStatus } from '@prisma/client';

/**
 * Response DTO — the shape returned to API clients.
 * Deliberately omits internal-only fields (`tenantId`, `deletedAt`, `deletedBy`,
 * `createdBy`) that have no value outside the server; dates are serialised to
 * ISO strings rather than leaking Prisma `Date` objects.
 */
export interface ProjectResponseDto {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  clientId: string;
  managerId: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  /** Computed: true if dueDate has passed and the project is not in a terminal status. */
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}
