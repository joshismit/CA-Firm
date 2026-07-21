import { Project, ProjectStatus } from '@prisma/client';
import { ProjectResponseDto } from '../dto/project.res.dto';

const TERMINAL_STATUSES: ProjectStatus[] = [
  ProjectStatus.COMPLETED,
  ProjectStatus.ARCHIVED,
  ProjectStatus.CANCELLED,
];

/**
 * Entity ⇄ DTO mapper for `Project`. Controllers/services must always return
 * data through this mapper — never serialize a raw Prisma `Project` in a
 * response.
 */
export class ProjectMapper {
  static toResponseDto(project: Project): ProjectResponseDto {
    const isOverdue =
      !!project.dueDate &&
      project.dueDate.getTime() < Date.now() &&
      !TERMINAL_STATUSES.includes(project.status);

    return {
      id: project.id,
      code: project.code,
      name: project.name,
      status: project.status,
      clientId: project.clientId,
      managerId: project.managerId,
      startDate: project.startDate ? project.startDate.toISOString() : null,
      dueDate: project.dueDate ? project.dueDate.toISOString() : null,
      completedAt: project.completedAt ? project.completedAt.toISOString() : null,
      archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
      isOverdue,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(projects: Project[]): ProjectResponseDto[] {
    return projects.map((project) => this.toResponseDto(project));
  }
}
