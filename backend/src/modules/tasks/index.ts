// tasks module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting), the service (so other modules can compose with it in-process),
// permission constants, and DTO types. `TaskRepository`, `TaskController`,
// and `TaskMapper` are deliberately NOT exported — they're internal
// implementation details; other modules should go through `TaskService`,
// never around it. Mirrors `modules/projects/index.ts`.

export { default as taskRoutes } from './routes/task.routes';
export { TaskService } from './service/task.service';
export { TASK_PERMISSIONS } from './constants/task.permissions';
export type { TaskResponseDto } from './dto/task.res.dto';
export type {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  ListTasksQueryDto,
} from './dto/task.req.dto';
