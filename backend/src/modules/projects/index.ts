// projects module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting), the service (so other modules can compose with it in-process —
// e.g. a future cross-module tenant-ownership check), permission constants,
// and DTO types. `ProjectRepository`, `ProjectController`, and
// `ProjectMapper` are deliberately NOT exported — they're internal
// implementation details; other modules should go through `ProjectService`,
// never around it.

export { default as projectRoutes } from './routes/project.routes';
export { ProjectService } from './service/project.service';
export { PROJECT_PERMISSIONS } from './constants/project.permissions';
export type { ProjectResponseDto } from './dto/project.res.dto';
export type {
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
  ListProjectsQueryDto,
} from './dto/project.req.dto';
