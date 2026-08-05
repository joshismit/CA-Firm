// tasks module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting), the services (so other modules can compose with them in-process),
// permission constants, and DTO types. `TaskRepository`, `TaskReminderRepository`,
// `TaskController`, and `TaskMapper` are deliberately NOT exported — they're
// internal implementation details; other modules should go through
// `TaskService`/`TaskReminderService`, never around them. Mirrors
// `modules/projects/index.ts`.
//
// `TaskReminderService` (PRD §4.2) is exported specifically so
// `workers/task-reminder.worker.ts` — outside this module — can compose with
// it, the same reason `AuditLogRecorder`/`NotificationDispatchService` are
// their own modules' public surface.

export { default as taskRoutes } from './routes/task.routes';
export { TaskService } from './service/task.service';
export { TaskReminderService } from './service/task-reminder.service';
export type { TaskReminderRunSummary } from './service/task-reminder.service';
export { TASK_PERMISSIONS } from './constants/task.permissions';
export type { TaskResponseDto } from './dto/task.res.dto';
export type {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  ListTasksQueryDto,
} from './dto/task.req.dto';
