// tasks module — public exports
//
// Only the module's actual public surface is exported here: the routers (for
// mounting), the services (so other modules can compose with them in-process),
// permission constants, and DTO types. `TaskRepository`, `TaskReminderRepository`,
// `TaskTemplateRepository`, `TaskController`, `TaskTemplateController`,
// `TaskMapper`, and `TaskTemplateMapper` are deliberately NOT exported —
// they're internal implementation details; other modules should go through
// `TaskService`/`TaskReminderService`/`TaskTemplateService`, never around
// them. Mirrors `modules/projects/index.ts`.
//
// `TaskReminderService` (PRD §4.2) is exported specifically so
// `workers/task-reminder.worker.ts` — outside this module — can compose with
// it, the same reason `AuditLogRecorder`/`NotificationDispatchService` are
// their own modules' public surface.

export { default as taskRoutes } from './routes/task.routes';
export { default as taskTemplateRoutes } from './routes/task-template.routes';
export { TaskService } from './service/task.service';
export { TaskReminderService } from './service/task-reminder.service';
export { TaskTemplateService } from './service/task-template.service';
export type { TaskReminderRunSummary } from './service/task-reminder.service';
export { TASK_PERMISSIONS } from './constants/task.permissions';
export { TASK_TEMPLATE_PERMISSIONS } from './constants/task-template.permissions';
export type { TaskResponseDto } from './dto/task.res.dto';
// Type-only — `TaskRepository` itself is still never exported (see this file's
// header comment). `DashboardAggregationService` needs the filter shape to
// call `TaskService.searchForDashboard()` (PRD §10.5).
export type { TaskSearchFilters } from './repository/task.repository';
// Work Calendar — `CalendarAggregationService` needs this shape to consume
// `TaskService.searchForCalendar()`'s output, same reasoning as `TaskSearchFilters` above.
export type { TaskWithCalendarRelations } from './service/task.service';
// `DashboardAggregationService` reuses this exact "open task" status list for
// its "Pending Works"/"Due Dates" widgets, rather than inventing a third
// definition alongside this and `ReportsRepository`'s own `OPEN_TASK_STATUSES`.
export { TERMINAL_STATUSES } from './repository/task.repository';
export type {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  AssignTaskDto,
  RejectTaskDto,
  ListTasksQueryDto,
} from './dto/task.req.dto';
export type { TaskTemplateResponseDto } from './dto/task-template.res.dto';
export type {
  CreateTaskTemplateDto,
  UpdateTaskTemplateDto,
  InstantiateTaskTemplateDto,
  ListTaskTemplatesQueryDto,
} from './dto/task-template.req.dto';
