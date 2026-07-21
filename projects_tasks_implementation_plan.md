# Projects (Engagements) & Task Management — Architecture & Implementation Specification

> Status: **Architecture only — no code, no Prisma models, no controllers/repositories.**
> Mirrors the format of [implementation_plan.md](implementation_plan.md) (Auth module spec) and the conventions surveyed in `backend/src/shared/base/*`, `backend/src/shared/enums/permission.enum.ts`, and `database_architecture.md`.

---

## 1. Module Objectives

Projects (internally: **Engagements**) and Tasks are the operational core of the ERP. Every other module either *feeds* work into this module or *consumes* signals from it:

- **CRM** converts an opportunity into a signed engagement → this module turns that into a `Project`.
- **Billing** cannot invoice without knowing what work was delivered → this module supplies billable time and milestone completions.
- **Compliance** cannot track statutory deadlines without a place to attach due dates and ownership → this module supplies `Task` due dates and reminders.
- **Dashboard** cannot show "what's happening in the firm today" without an aggregation source → this module is that source.

Without this module, the ERP has clients and contacts but no record of *what work is being done, by whom, by when, and whether it's late*. It exists to answer three questions at all times: **What is owed to the client? Who owns it? Is it on track?**

### Integration Summary

| Module | Relationship | Direction |
|---|---|---|
| **Clients** | Every `Project` belongs to exactly one `Client`. Client 360° view aggregates all projects, their status, and outstanding tasks. Recurring statutory work (e.g. annual audit) is modeled as a `RecurringTask`/project template tied to the client. | Clients → Projects |
| **Business** | The firm's service catalog (service lines, e.g. "Statutory Audit," "GST Return," "ROC Filing," defined in the Business module) determines a `Project`'s `serviceLineId`, default task checklist, required documents, and default fee structure. | Business → Projects |
| **Contacts** | Contacts are client-side people (not internal staff). A `Project` references a primary client `Contact` for status communication; `TaskWatcher`/`TaskComment` can notify a Contact via the Notifications module without granting portal access unless explicitly configured. | Contacts → Projects/Tasks (read-only reference) |
| **Documents** *(not yet built)* | `TaskAttachment` and a future `ProjectDocument` join store a `documentId` FK contract into the Documents module (workpapers, client uploads, signed deliverables). OCR-based document classification will later raise a `DocumentClassified` event this module subscribes to, auto-generating tasks (see §14). | Documents ⇄ Tasks |
| **Billing** *(not yet built)* | `Project` carries billing configuration (fixed fee / hourly / retainer). `TaskTimeEntry.billable` feeds invoice line items. `ProjectMilestone` completion can trigger milestone-based invoicing. Billing owns the `Invoice` model with an FK back to `Project`. | Projects/Tasks → Billing |
| **Compliance** *(not yet built)* | Statutory due dates (GST, TDS, ROC, Income Tax) are compliance-calendar entries that materialize as `Project`+`Task` sets via `RecurringTask` rules. `TaskOverdue` events feed compliance risk scoring. | Compliance → Projects/Tasks (generator); Tasks → Compliance (status feedback) |
| **Dashboard** | Read-only aggregation: pending tasks, overdue work, workload per staff member, project progress, billable hours. See §13. | Projects/Tasks → Dashboard |
| **Notifications** | Domain events (`TaskAssigned`, `TaskOverdue`, `CommentAdded`, `ReminderTriggered`, etc.) are published to the Notifications module for email/push/in-app delivery. | Projects/Tasks → Notifications |

---

## 2. Folder Structure

Two sibling feature modules, following the structure already established for `auth` (per `implementation_plan.md`) and the layout requested for this module:

```text
src/modules/projects/
├── controllers/
│   └── project.controller.ts
├── services/
│   ├── project.service.ts
│   └── milestone.service.ts
├── repositories/
│   ├── project.repository.ts
│   ├── project-member.repository.ts
│   └── project-milestone.repository.ts
├── dto/
│   ├── project.req.dto.ts        (Zod-inferred request types)
│   └── project.res.dto.ts        (response shapes)
├── schemas/
│   └── project.schema.ts         (Zod validation schemas)
├── routes/
│   └── project.routes.ts
├── permissions/
│   └── project.permissions.ts    (maps PermissionResource.PROJECTS actions to routes)
├── mapper/
│   └── project.mapper.ts         (entity ⇄ DTO)
├── constants/
│   └── project.constants.ts      (status enums, default lifecycle rules)
├── events/
│   └── project.events.ts         (ProjectCreated, ProjectCompleted, ...)
└── index.ts                      (module bootstrap: registers routes + DI wiring)

src/modules/tasks/
├── controllers/
│   ├── task.controller.ts
│   ├── task-comment.controller.ts
│   ├── task-attachment.controller.ts
│   ├── task-time-entry.controller.ts
│   └── task-label.controller.ts
├── services/
│   ├── task.service.ts
│   ├── task-assignment.service.ts
│   ├── time-tracking.service.ts
│   ├── checklist.service.ts
│   ├── activity.service.ts
│   ├── reminder.service.ts
│   └── recurring-task.service.ts
├── repositories/
│   ├── task.repository.ts
│   ├── task-assignment.repository.ts
│   ├── task-checklist.repository.ts
│   ├── task-comment.repository.ts
│   ├── task-attachment.repository.ts
│   ├── task-activity.repository.ts
│   ├── task-dependency.repository.ts
│   ├── task-watcher.repository.ts
│   ├── task-label.repository.ts
│   ├── task-time-entry.repository.ts
│   └── task-reminder.repository.ts
├── dto/
├── schemas/
├── routes/
├── permissions/
│   └── task.permissions.ts
├── mapper/
├── constants/
└── events/
    └── task.events.ts

src/jobs/workers/                  (shared BullMQ workers, not owned by either module)
├── task-reminder.worker.ts
├── overdue-task.worker.ts
├── recurring-task.worker.ts
├── project-summary.worker.ts
└── weekly-report.worker.ts
```

**Naming note:** `backend/scripts/scaffold-modules.ts` currently scaffolds singular folder names (`controller/`, `service/`, `repository/`) while `implementation_plan.md` (auth) and this document use plural (`controllers/`, `services/`, `repositories/`). Since no business module has been implemented yet under either convention, this should be resolved as a one-time decision before scaffolding `projects`/`tasks` — this document assumes **plural**, matching the auth spec and the folder layout requested for this module. Do not silently diverge per-module.

---

## 3. Database Models

All models are tenant-scoped (`tenantId`), soft-deletable (`deletedAt`/`deletedBy`), and audit-stamped (`createdBy`/`updatedBy`), consistent with the existing `Tenant`/`User`/`Role` models and enforced automatically by `BaseRepository`.

### Requested Models

| Model | Purpose | Key Fields (conceptual) | Relationships |
|---|---|---|---|
| **Project** | An engagement — one unit of billable client work. | `clientId`, `serviceLineId` (→ Business), `code` (human-readable engagement number), `name`, `status`, `priority`, `startDate`, `dueDate`, `completedAt`, `archivedAt`, `billingType` (fixed/hourly/retainer), `budgetAmount`, `progressPercent`, `primaryContactId` (→ Contacts), `managerId` (→ User) | Client 1—*, Business 1—*, ProjectMember 1—*, ProjectMilestone 1—*, Task 1—* |
| **ProjectMember** | Join table: which internal Users work on a Project, in what role. | `projectId`, `userId`, `roleOnProject` (MANAGER / REVIEWER / CONTRIBUTOR / OBSERVER), `addedAt`, `removedAt` | Project *—*, User *—* |
| **ProjectMilestone** | Named checkpoint inside a project (e.g. "Draft Financials Ready," "Filing Submitted") used for progress rollup and milestone-based billing. | `projectId`, `name`, `dueDate`, `status`, `completedAt`, `sequence`, `weightPercent` (contribution to project progress) | Project 1—* |
| **Task** | Atomic unit of work. | `projectId` (nullable — see below), `title`, `description`, `status`, `priority`, `startDate`, `dueDate`, `completedAt`, `estimatedHours`, `requiresApproval`, `parentTaskId` (self-FK for subtasks), `milestoneId` (nullable), `recurringTaskId` (nullable, → RecurringTask), `position` (for Kanban ordering) | Project 1—*, Milestone 0..1—*, self-referential subtasks |
| **TaskAssignment** | Join table: which Users are assigned to a Task (supports multi-assignee). | `taskId`, `userId`, `assignedBy`, `assignedAt`, `isPrimary` | Task *—*, User *—* |
| **TaskChecklist** | Sub-items inside a task ("checklist within a task," lighter than full subtasks). | `taskId`, `label`, `isDone`, `doneBy`, `doneAt`, `sequence` | Task 1—* |
| **TaskComment** | Threaded discussion on a task. | `taskId`, `authorId`, `body`, `parentCommentId` (threading), `editedAt` | Task 1—*, self-referential thread |
| **TaskAttachment** | File attached to a task. Stores a **reference** to the Documents module, not the file itself. | `taskId`, `documentId` (FK contract → Documents module), `fileName`, `uploadedBy` | Task 1—*, Documents (cross-module) |
| **TaskActivity** | Immutable audit/timeline feed for a task (status changes, assignment changes, comments posted, attachments added). | `taskId`, `actorId`, `activityType`, `metadata` (JSON snapshot of before/after), `createdAt` | Task 1—* |
| **TaskDependency** | Predecessor/successor relationship between two tasks (blocking, for Gantt). | `predecessorTaskId`, `successorTaskId`, `dependencyType` (FINISH_TO_START default), `createdBy` | Task *—* (self-referential, two FKs) |
| **TaskWatcher** | Users who receive notifications on a task without being assigned. | `taskId`, `userId`, `addedAt` | Task *—*, User *—* |
| **TaskLabel** | Tenant-scoped master list of labels (e.g. "Urgent," "Client Waiting," "Internal Review"). | `tenantId`, `name`, `color` | Tenant 1—* |
| **TaskTimeEntry** | Logged time against a task, the billing source of truth. | `taskId`, `userId`, `startedAt`, `endedAt`, `durationMinutes`, `billable`, `note`, `approvedBy`, `approvedAt`, `invoiceLineItemId` (nullable, set once billed → Billing) | Task 1—*, User 1—*, Billing (cross-module) |
| **TaskReminder** | Scheduled reminder for a task deadline. | `taskId`, `remindAt`, `recipientId`, `channel` (email/push/in-app), `triggeredAt` | Task 1—* |
| **RecurringTask** | A rule that regenerates a Task (or a whole Project from a template) on a schedule — the engine behind statutory recurring work. | `tenantId`, `sourceTaskId` or `projectTemplateId`, `frequency` (cron expression or RRULE), `nextRunAt`, `lastRunAt`, `isActive`, `leadDays` (how far ahead to generate) | Task/Project 1—* generated occurrences |

### Additional Models (justified)

| Model | Justification |
|---|---|
| **ProjectActivity** | `TaskActivity` is explicitly requested for task-level audit trail, but `Project` needs the equivalent immutable timeline (status transitions, member added/removed, milestone completed, budget changed) for the same reason: dashboards and client-facing status reports need a chronological feed, and audit/compliance needs an immutable record. Reusing `TaskActivity` for both would conflate two different aggregate roots and break FK clarity — a dedicated table is one join cheaper and semantically correct. |
| **TaskLabelAssignment** | `TaskLabel` (requested) is a master list; a task can carry multiple labels and a label applies to many tasks, so a many-to-many join table is required. Listed separately because it's structurally distinct from `TaskLabel` itself (which only stores label definitions). |

**Deliberately not added as separate tables** (to avoid over-engineering ahead of need):
- No separate `ProjectBillingConfig` table — billing fields are few enough (`billingType`, `budgetAmount`) to live directly on `Project`; promote to a dedicated table only if Billing module requirements grow.
- No separate `ProjectStatusHistory`/`TaskStatusHistory` — status transitions are one `activityType` value inside `ProjectActivity`/`TaskActivity`, not a parallel table.
- No `ProjectTemplate`/`TaskTemplate` tables in this phase — templates are a Phase 2 concern (§14) and should not block the initial release.

**Important scoping decision — `Task.projectId` is nullable.** Not all firm work is engagement-billable (internal admin tasks, one-off requests). Tasks may exist standalone (`projectId = null`) or attached to a Project. All Project-level rollups (progress %, dashboard "project tasks") simply filter on non-null `projectId`.

---

## 4. Relationships

```
Tenant
  └─ Client
       └─ Project ── (belongs to) ── Business.ServiceLine
            ├─ ProjectMember ── User
            ├─ ProjectMilestone
            ├─ ProjectActivity
            └─ Task (projectId nullable → standalone tasks allowed)
                 ├─ TaskAssignment ── User
                 ├─ TaskChecklist
                 ├─ TaskComment (self-referential thread)
                 ├─ TaskAttachment ──── Document (Documents module, cross-boundary FK)
                 ├─ TaskActivity
                 ├─ TaskDependency (self-referential: predecessor/successor)
                 ├─ TaskWatcher ── User
                 ├─ TaskLabelAssignment ── TaskLabel
                 ├─ TaskTimeEntry ── User ──── Invoice.LineItem (Billing module, cross-boundary FK)
                 ├─ TaskReminder
                 └─ RecurringTask (generator, 1 rule → many Task occurrences)
```

**Cardinality notes:**
- `Tenant 1—*Client 1—*Project`: strict — no cross-tenant or cross-client project reassignment; reassigning a project to a different client is a destructive operation gated behind `projects:manage`.
- `Project 1—*Task`, but `Task.projectId` is optional (see §3).
- `Task *—* User` happens twice, for two different reasons: `TaskAssignment` (who is responsible/accountable) and `TaskWatcher` (who is informed). Keep these separate — conflating them would force every watcher to also be an assignee.
- `TaskDependency` is a self-join on `Task` with two FKs (`predecessorTaskId`, `successorTaskId`) rather than a status flag, so a task can have multiple predecessors/successors (true DAG, required for Gantt).
- `Task → Document` and `TaskTimeEntry → Invoice` are **cross-module FK contracts**: this module owns the FK column and validates referential existence via the other module's repository interface, but does not own those tables. This keeps modules independently deployable/testable while preserving relational integrity at the application layer (consistent with the "Shared Database, Shared Schema" strategy in `database_architecture.md`).

---

## 5. Lifecycle

### Project Lifecycle

```
Draft → Planned → Active → On Hold → Completed → Archived
  ↓        ↓         ↓         ↓
  └────────┴─────────┴─────────┴──→ Cancelled  (terminal, from any non-terminal state)
```

| Transition | Guard / Precondition | Side Effects |
|---|---|---|
| Draft → Planned | At least one `ProjectMember` with role MANAGER assigned; at least one Milestone or task-set applied. | `ProjectActivity` entry; `ProjectCreated`-adjacent validation, no event (Draft is the creation state). |
| Planned → Active | `startDate <= today`. If the service line requires an engagement letter (Compliance/Documents integration), that document must be attached. | Emits `ProjectActivated` (internal); Task due dates recalculated relative to `startDate` if templated. |
| Active ⇄ On Hold | Requires a `reason` string. | Notifies all `ProjectMember`s and `TaskWatcher`s on affected tasks. Tasks are **not** auto-paused — On Hold affects reporting/dashboard grouping, not task state, so day-to-day checklist work can continue if appropriate. |
| Active → Completed | **All** non-cancelled Tasks under the project must be in `Completed` or `Cancelled` state. All Milestones must be `Completed`. | Emits `ProjectCompleted`; sets `completedAt`; triggers final-billing hook for Billing module. |
| Completed → Archived | Requires `projects:archive` permission. | Sets `archivedAt`; project (and all its tasks) become **read-only** (§10) — enforced at the service layer, not just UI. |
| Completed → Active (reopen) | Requires `projects:manage`; must provide a reason. | Emits `ProjectReopened`; clears `completedAt`; logged as a `ProjectActivity` entry (reopening a closed engagement is rare but happens — e.g. auditor requests a revision — and must be auditable, not silently allowed). |
| Any non-terminal → Cancelled | Requires `projects:archive` or `projects:manage`; requires reason. | Cascades a *soft* cancellation prompt to open tasks (does not force-cancel without confirmation, since some tasks may be reusable elsewhere). |
| Archived | Terminal for all practical purposes; only reversible via `projects:manage` (unarchive → Completed), never directly to Active. | — |

### Task Lifecycle

```
Todo → In Progress → Review → Completed
  ↓         ↓            ↓
  └─────────┴────────────┴──→ Cancelled  (terminal, from any non-terminal state)
```

| Transition | Guard / Precondition | Side Effects |
|---|---|---|
| Todo → In Progress | Auto-transitions on first `TaskTimeEntry` logged, or explicit `tasks:update` action. Blocked if any `TaskDependency` predecessor is not `Completed` (when strict dependency mode is enabled for the project). | `TaskActivity` entry. |
| In Progress → Review | Only reachable if `Task.requiresApproval = true` and a reviewer (`TaskAssignment` with role or a designated approver) exists. Otherwise In Progress → Completed directly. | Notifies reviewer. |
| Review → Completed | Requires `tasks:approve`, held by someone other than the task's primary assignee (four-eyes principle for CA workpapers). | Emits `TaskCompleted`; updates parent `ProjectMilestone`/`Project.progressPercent` (§10). |
| Review → In Progress (rejected) | Requires a comment explaining rejection (enforced at service layer, not DB). | Emits `TaskRejected`; notifies assignee. |
| Any non-terminal → Cancelled | Requires reason; blocked if the task has approved, invoiced `TaskTimeEntry` records (cannot cancel already-billed work — cancel the invoice adjustment instead). | `TaskActivity` entry. |
| Completed → In Progress (reopen) | Allowed within a configurable grace window (default 7 days) or with `tasks:manage`. Blocked entirely if the parent `Project` is `Archived` (read-only rule takes precedence). | Emits `TaskReopened`. |
| Cancelled | Terminal. | — |

---

## 6. Permissions

Follows the existing `"resource:action"` convention (`backend/src/shared/enums/permission.enum.ts`), enforced by the existing `requirePermission()` / `requireAnyPermission()` middleware. **`PermissionResource.PROJECTS` does not yet exist in the enum and must be added; `PermissionResource.TASKS` already exists.**

| Permission | Description |
|---|---|
| `projects:create` | Create a new project/engagement. |
| `projects:view` | View projects the user is a member of. |
| `projects:view_all` | View all tenant projects regardless of membership (partner/manager oversight). |
| `projects:update` | Edit project details, dates, budget, service line. |
| `projects:assign_member` | Add/remove `ProjectMember`s. |
| `projects:milestone_manage` | Create/update/complete milestones. |
| `projects:archive` | Move a project to Cancelled or Archived. |
| `projects:manage` | Full control: reopen archived/completed projects, override read-only lock, reassign client. |
| `projects:export` | Export project lists/reports. |
| `tasks:create` | Create a task (standalone or under a project). |
| `tasks:view` | View tasks assigned to or watched by the user. |
| `tasks:view_all` | View all tenant tasks (manager oversight, dashboard). |
| `tasks:update` | Edit task fields, move between Todo/In Progress. |
| `tasks:assign` | Assign/reassign a task to users. |
| `tasks:complete` | Move a task directly to Completed (when no approval required). |
| `tasks:approve` | Move a task from Review → Completed (four-eyes approval). |
| `tasks:delete` | Soft-delete a task (only if not Completed — see §10). |
| `tasks:manage` | Full control: reopen Completed tasks past grace window, override dependency locks. |
| `tasks:comment` | Post comments on a task. |
| `tasks:attach` | Attach/remove documents. |
| `tasks:track_time` | Log `TaskTimeEntry`. |
| `tasks:time_approve` | Approve logged time before it becomes billable (Billing gate). |
| `tasks:label_manage` | Create/edit/delete `TaskLabel` definitions (tenant-wide, admin-ish). |
| `tasks:export` | Export task lists/timesheets. |

---

## 7. APIs

All routes versioned under `/api/v1/`, guarded by `jwtGuard` then the relevant `requirePermission(...)`, consistent with the Auth module's middleware order.

### Projects

| Method | Path | Permission |
|---|---|---|
| POST | `/projects` | `projects:create` |
| GET | `/projects` | `projects:view` (scoped) / `projects:view_all` |
| GET | `/projects/:id` | `projects:view` |
| PATCH | `/projects/:id` | `projects:update` |
| PATCH | `/projects/:id/status` | `projects:update` (lifecycle transition, validated per §5) |
| DELETE | `/projects/:id` | `projects:archive` (soft delete / cancel) |
| POST | `/projects/:id/archive` | `projects:archive` |
| POST | `/projects/:id/reopen` | `projects:manage` |
| GET | `/projects/:id/members` | `projects:view` |
| POST | `/projects/:id/members` | `projects:assign_member` |
| DELETE | `/projects/:id/members/:userId` | `projects:assign_member` |
| GET | `/projects/:id/activity` | `projects:view` |
| GET | `/projects/:id/progress` | `projects:view` |

### Milestones

| Method | Path | Permission |
|---|---|---|
| GET | `/projects/:id/milestones` | `projects:view` |
| POST | `/projects/:id/milestones` | `projects:milestone_manage` |
| PATCH | `/milestones/:id` | `projects:milestone_manage` |
| POST | `/milestones/:id/complete` | `projects:milestone_manage` |
| DELETE | `/milestones/:id` | `projects:milestone_manage` |

### Tasks

| Method | Path | Permission |
|---|---|---|
| POST | `/tasks` | `tasks:create` |
| GET | `/tasks` | `tasks:view` (filters: projectId, assigneeId, status, labelId, dueBefore/after) |
| GET | `/tasks/:id` | `tasks:view` |
| PATCH | `/tasks/:id` | `tasks:update` |
| PATCH | `/tasks/:id/status` | `tasks:update` / `tasks:approve` (Review→Completed) |
| DELETE | `/tasks/:id` | `tasks:delete` |
| POST | `/tasks/:id/assignments` | `tasks:assign` |
| DELETE | `/tasks/:id/assignments/:userId` | `tasks:assign` |
| GET | `/tasks/:id/checklist` | `tasks:view` |
| POST | `/tasks/:id/checklist` | `tasks:update` |
| PATCH | `/checklist-items/:id` | `tasks:update` |
| DELETE | `/checklist-items/:id` | `tasks:update` |
| POST | `/tasks/:id/watchers` | `tasks:update` |
| DELETE | `/tasks/:id/watchers/:userId` | `tasks:update` |
| POST | `/tasks/:id/dependencies` | `tasks:update` |
| DELETE | `/tasks/dependencies/:id` | `tasks:update` |

### Comments

| Method | Path | Permission |
|---|---|---|
| GET | `/tasks/:id/comments` | `tasks:view` |
| POST | `/tasks/:id/comments` | `tasks:comment` |
| PATCH | `/comments/:id` | `tasks:comment` (own comment only) |
| DELETE | `/comments/:id` | `tasks:comment` (own) / `tasks:manage` (any) |

### Attachments

| Method | Path | Permission |
|---|---|---|
| GET | `/tasks/:id/attachments` | `tasks:view` |
| POST | `/tasks/:id/attachments` | `tasks:attach` (registers a `documentId` already uploaded via Documents module) |
| DELETE | `/attachments/:id` | `tasks:attach` |

### Time Tracking

| Method | Path | Permission |
|---|---|---|
| GET | `/tasks/:id/time-entries` | `tasks:view` |
| POST | `/tasks/:id/time-entries` | `tasks:track_time` |
| PATCH | `/time-entries/:id` | `tasks:track_time` (own, unapproved only) |
| DELETE | `/time-entries/:id` | `tasks:track_time` (own, unapproved) |
| POST | `/time-entries/:id/approve` | `tasks:time_approve` |
| GET | `/time-entries/my-timesheet` | `tasks:track_time` |

### Labels

| Method | Path | Permission |
|---|---|---|
| GET | `/labels` | `tasks:view` |
| POST | `/labels` | `tasks:label_manage` |
| PATCH | `/labels/:id` | `tasks:label_manage` |
| DELETE | `/labels/:id` | `tasks:label_manage` |
| POST | `/tasks/:id/labels/:labelId` | `tasks:update` |
| DELETE | `/tasks/:id/labels/:labelId` | `tasks:update` |

### Activity

| Method | Path | Permission |
|---|---|---|
| GET | `/tasks/:id/activity` | `tasks:view` |

---

## 8. Services

| Service | Responsibilities |
|---|---|
| **ProjectService** | Orchestrates project CRUD, lifecycle transitions (validates guards from §5), member management, progress rollup (delegates to `MilestoneService` and `TaskService` for the actual percentage math), emits project domain events. |
| **TaskService** | Orchestrates task CRUD, lifecycle transitions, dependency validation (blocks In Progress if predecessors incomplete), subtask handling, delegates checklist/comment/attachment/time-entry operations to their own repositories, emits task domain events. |
| **MilestoneService** | Manages milestone CRUD and completion; recalculates `Project.progressPercent` as a weighted rollup of milestone completion (falls back to task-completion-ratio when no milestones exist). |
| **TimeTrackingService** | Validates no overlapping `TaskTimeEntry` windows per user (see §10), computes durations, manages the approval gate before entries become eligible for Billing, exposes timesheet queries. |
| **ActivityService** | Single write-path for `ProjectActivity`/`TaskActivity` entries — every other service calls into this rather than writing activity rows directly, so the audit feed format stays consistent. |
| **ReminderService** | Schedules/cancels `TaskReminder` rows based on due dates and project status changes (e.g. cancels reminders when a task is cancelled); the actual dispatch is a BullMQ worker (§12), this service only manages the reminder *records*. |
| **TaskAssignmentService** *(supporting)* | Assign/reassign/unassign users to tasks; enforces at least one assignee before a task can leave Todo. |
| **RecurringTaskService** *(supporting)* | Evaluates `RecurringTask` rules and generates the next `Task`/`Project` occurrence; invoked by the recurring-task worker, not by end-user requests directly. |
| **ChecklistService** *(supporting)* | CRUD for `TaskChecklist` items; recalculates a lightweight "checklist %" used as a UI progress hint (distinct from milestone-based project progress). |

---

## 9. Repository Responsibilities

All repositories extend `BaseRepository<Delegate, Entity>` and therefore inherit tenant scoping, soft delete, and the standard CRUD/pagination surface (`findById`, `findMany`, `paginate`, `create`, `update`, `delete`, `restore`, `forceDelete`, `exists`, `count`) for free. Each adds only what's genuinely specific to its entity:

| Repository | Additions beyond BaseRepository |
|---|---|
| **ProjectRepository** | `findByClient(clientId)`, `findOverdue()`, `findByStatus(status[])`, `findWithProgress(id)` (joins milestones/tasks for the progress computation). |
| **ProjectMemberRepository** | `findByProject`, `findByUser` (a user's project portfolio), `isMember(projectId, userId)`. |
| **ProjectMilestoneRepository** | `findByProject(ordered by sequence)`, `sumWeightPercent(projectId)` (validation: weights must total 100). |
| **TaskRepository** | `findByAssignee`, `findByProject`, `findOverdue`, `findByLabel`, `findBlocking(taskId)` (predecessors not yet complete), `reorder(taskIds[])` (Kanban position updates). |
| **TaskAssignmentRepository** | `findByTask`, `findByUser` (workload queries for Dashboard). |
| **TaskChecklistRepository** | `findByTask(ordered by sequence)`. |
| **TaskCommentRepository** | `findByTask(threaded)`. |
| **TaskAttachmentRepository** | `findByTask`; validates `documentId` existence via injected Documents-module interface (not a direct table join). |
| **TaskActivityRepository** | `findByTask(paginated, newest first)` — **append-only**, no `update()` exposed (activity rows are immutable; even `BaseRepository.update` should not be called on this entity — enforce at the service layer by simply never wiring an update path). |
| **TaskDependencyRepository** | `findPredecessors(taskId)`, `findSuccessors(taskId)`, `wouldCreateCycle(predecessorId, successorId)` (DAG cycle check before insert). |
| **TaskWatcherRepository** | `findByTask`, `isWatching(taskId, userId)`. |
| **TaskLabelRepository** | `findByTenant`. |
| **TaskLabelAssignmentRepository** | `findLabelsForTask`, `findTasksForLabel`. |
| **TaskTimeEntryRepository** | `findByTask`, `findByUser(dateRange)`, `findOverlapping(userId, start, end)` (for the no-overlap business rule), `findUnbilled(projectId)` (Billing hand-off). |
| **TaskReminderRepository** | `findDue(now)` (consumed by the reminder worker), `cancelForTask(taskId)`. |
| **RecurringTaskRepository** | `findDueToRun(now)` (consumed by the recurring-task worker). |
| **ProjectActivityRepository** | Same append-only pattern as `TaskActivityRepository`. |

---

## 10. Business Rules

1. A project cannot move to `Completed` while any non-cancelled task under it is not `Completed`/`Cancelled` (§5).
2. A completed task cannot be deleted — only cancelled tasks and non-billed, non-completed tasks are hard/soft-deletable (`tasks:delete` checks state first).
3. Milestone completion recalculates `Project.progressPercent` as `Σ(completed milestone weightPercent)`; if no milestones exist, progress falls back to `completedTasks / totalTasks` for that project.
4. Task assignment (`TaskAssignment` insert) enqueues a `TaskAssigned` notification job — this is fire-and-forget from the caller's perspective (service returns immediately; delivery is async).
5. Task completion (Review → Completed or direct Completed) writes a `TaskActivity` entry via `ActivityService` before the transaction commits — activity logging is part of the atomic state change, not an afterthought.
6. A `RecurringTask` rule automatically creates the next occurrence `leadDays` before it's due, never earlier — prevents flooding task lists with far-future recurring items.
7. `TaskTimeEntry` windows for the same user cannot overlap (`findOverlapping` check in `TimeTrackingService.logTime()`), since overlapping time is either a data-entry error or double-billing risk.
8. An `Archived` project is fully read-only: no task under it may change status, no time may be logged against it, no comments may be added — enforced centrally in `TaskService`/`ProjectService` by checking parent project state before any mutation, not duplicated per-endpoint.
9. `TaskDependency` insertion is rejected if it would create a cycle (`wouldCreateCycle` check) — required for a valid Gantt DAG.
10. A task cannot leave `Todo` if it has an incomplete blocking predecessor **and** the project has `strictDependencies = true` (a per-project toggle — some engagements don't need hard blocking).
11. Cancelling a task with already-approved `TaskTimeEntry` records is blocked — approved time is a billing input and must be reversed through Billing's adjustment flow, not silently orphaned.
12. Reopening a `Completed` task past the grace window, or reopening an `Archived`/`Completed` project, requires the elevated `*:manage` permission and always writes an activity entry with the actor and reason — these are exceptions to the normal flow and must be traceable.
13. Deleting a `TaskLabel` does not delete `TaskLabelAssignment` history silently — label assignments are removed via cascade, but the removal itself is not activity-logged per task (label taxonomy changes are tenant-admin housekeeping, not task-level events).
14. `ProjectMilestone.weightPercent` values for a project must sum to 100 if any milestone exists with milestone-based billing enabled — validated in `MilestoneService`, not the database (business rule, not a data constraint).
15. A `Task.dueDate` earlier than its `Project.startDate`, or later than its `Project.dueDate`, is allowed but flagged (warning, not a hard block) — real engagements slip, and the system should surface the anomaly rather than prevent legitimate work.

---

## 11. Events

Domain events are the mechanism by which this module talks to Notifications, Billing, Compliance, and Dashboard without those modules being directly imported here. **No event bus exists in the codebase yet** (`domain/events/` folders are empty scaffolds, and the only async infrastructure today is BullMQ). This module introduces the convention:

- A lightweight in-process `DomainEventBus` (synchronous `EventEmitter`-based, in `src/shared/events/`) for same-process subscribers.
- Events that need reliable, retryable, cross-process delivery (notifications, billing hooks) are **also** pushed onto the existing BullMQ `notification`/`audit` queues by a thin bridge — the event bus emits, a bridge listener enqueues.
- This is additive shared infrastructure, not a modification of any existing module.

| Event | Payload (conceptual) | Typical Subscriber |
|---|---|---|
| `ProjectCreated` | projectId, clientId, serviceLineId, createdBy | Dashboard, Audit |
| `ProjectActivated` | projectId | Notifications (team kickoff), Compliance |
| `ProjectCompleted` | projectId, completedAt | Billing (final invoice trigger), Dashboard, Notifications (client) |
| `ProjectReopened` | projectId, reason, actorId | Audit, Notifications |
| `ProjectArchived` | projectId | Dashboard |
| `TaskCreated` | taskId, projectId?, createdBy | Dashboard |
| `TaskAssigned` | taskId, userId, assignedBy | Notifications |
| `TaskCompleted` | taskId, completedBy | Dashboard, Billing (if milestone-linked), Compliance |
| `TaskOverdue` | taskId, dueDate, assigneeIds | Notifications, Dashboard, Compliance (risk scoring) |
| `TaskReopened` | taskId, reason, actorId | Audit, Notifications |
| `CommentAdded` | taskId, commentId, authorId, mentions[] | Notifications (author + watchers + @mentions) |
| `ReminderTriggered` | reminderId, taskId, recipientId | Notifications |
| `MilestoneCompleted` | milestoneId, projectId | Billing (milestone invoicing), Dashboard |
| `TimeEntryApproved` | timeEntryId, taskId, userId, durationMinutes | Billing |
| `RecurringTaskGenerated` | recurringTaskId, newTaskId/newProjectId | Dashboard, Notifications |

---

## 12. Background Jobs

New BullMQ queues/workers under `src/jobs/workers/`, following the existing `QUEUE_NAMES` pattern in `backend/src/config/queue.ts` (which will need two additional queue name constants: `task-reminders`, `recurring-tasks` — or reuse the existing `notification`/`report` queues where the workload fits, to avoid unnecessary queue proliferation).

| Job | Schedule | Responsibility |
|---|---|---|
| **Daily reminder dispatch** | Cron, every 15 min | `TaskReminderRepository.findDue(now)` → dispatch via Notifications, mark `triggeredAt`. |
| **Overdue task sweep** | Cron, hourly | Find tasks past `dueDate` still open → emit `TaskOverdue` (idempotent — only fires once per task per day, tracked via a `lastOverdueNotifiedAt` field or a dedup key in Redis). |
| **Recurring task generation** | Cron, daily (early morning) | `RecurringTaskRepository.findDueToRun(now)` → `RecurringTaskService.generateNext()` → emits `RecurringTaskGenerated`. |
| **Project summary digest** | Cron, daily | Per-manager digest: projects nearing due date, at-risk milestones. Feeds Notifications (email digest). |
| **Weekly report** | Cron, weekly (Monday 7am) | Firm-wide rollup: completed vs. planned, billable hours, overdue count — feeds Dashboard cache and an optional emailed report. |

All jobs are tenant-aware: they iterate tenants (or run as a single cross-tenant query filtered per tenant inside the job, consistent with existing RLS-backed isolation) rather than requiring one scheduled job per tenant.

---

## 13. Dashboard Integration

The Dashboard module remains a **read-only consumer** — it does not own logic, only aggregation queries against this module's repositories (or a materialized/cached read model if volume warrants it later).

| Widget | Source |
|---|---|
| Pending tasks (per user) | `TaskRepository.findByAssignee(userId, status: Todo/InProgress)` |
| Upcoming deadlines | `TaskRepository.findByAssignee` + `ProjectRepository.findOverdue` filtered to a date window |
| Overdue work | `TaskRepository.findOverdue()`, `ProjectRepository.findOverdue()` |
| Project progress | `Project.progressPercent` (maintained by `MilestoneService`, not computed on read) |
| Resource workload | `TaskAssignmentRepository.findByUser` aggregated by status/estimated hours across all active projects |
| Billable hours | `TaskTimeEntryRepository` aggregated by user/date-range, filtered `billable = true` |

For firm-wide dashboards with heavy aggregation (weekly reports, workload heatmaps), prefer the **weekly report job** (§12) to pre-compute and cache results rather than running expensive aggregate queries on every dashboard page load.

---

## 14. Future-Proofing

The schema and API surface defined above are designed so these are additive, not re-architectures:

- **Kanban** — `Task.status` + `Task.position` already support column/order rendering; no schema change needed.
- **Calendar view** — `Task.dueDate`/`startDate` and `Project.dueDate` are already indexed fields; a calendar endpoint is a query, not a new model.
- **Gantt chart** — `TaskDependency` (DAG) plus `startDate`/`dueDate`/`estimatedHours` already provide everything a Gantt renderer needs.
- **Dependencies** — already modeled (`TaskDependency`); strict/soft enforcement is a per-project toggle (§10).
- **Recurring work** — already modeled (`RecurringTask`).
- **Templates** (Phase 2) — introduce `ProjectTemplate`/`TaskTemplate` tables that `ProjectService.createFromTemplate()` expands into real `Project`/`Task` rows; deliberately deferred from the initial release (§3) since it's additive sugar over existing CRUD, not a dependency of it.
- **Automation Rules** (Phase 2+) — a rule engine subscribing to the `DomainEventBus` introduced in §11 ("when TaskCompleted and label=X, auto-create task Y") — the event bus is the extension point; no core model changes required.
- **AI Task Suggestions** — consumes `TaskActivity`/`TaskComment` history plus `ServiceLine` checklist patterns as training/context signal; sits as a separate module that *reads* this module's data, does not require this module to change.
- **OCR-generated tasks** — Documents module publishes a `DocumentClassified` event (once it exists); `TaskService` subscribes and creates tasks from a mapping table (e.g. "invoice document type" → "reconciliation task"). The subscription point is the same `DomainEventBus`, so this module needs zero changes when Documents ships that capability — only a new listener.

---

## 15. Testing Strategy

| Level | Scope |
|---|---|
| **Unit** | Services with mocked repositories: lifecycle transition guards (§5) — every legal and illegal transition; business rules (§10) in isolation (overlap detection, cycle detection, progress rollup math). |
| **Integration** | Repositories against a real test database: tenant isolation (a query from tenant A must never return tenant B rows, including via joins like `TaskDependency`/`ProjectMember`), soft-delete filtering, cascade behavior on cancel/archive. |
| **E2E** | Full API flows per lifecycle: create project → add members → create tasks → assign → log time → complete → invoice hand-off fields populated correctly; permission-denial paths for each `*:manage`-gated action attempted by an under-privileged role. |
| **Performance** | Task list pagination under realistic volume (10k+ tasks/tenant), N+1 query checks on `TaskAssignment`/`TaskLabelAssignment` joins, index verification on `dueDate`/`status`/`tenantId` composite indexes, overdue-sweep job runtime at scale. |

---

## 16. Security

- **Tenant isolation** — inherited from `BaseRepository`; every new repository must go through it rather than raw Prisma calls, exactly as the Auth module does.
- **Audit logging** — `ProjectActivity`/`TaskActivity` are the domain-level audit trail (§9, append-only); this is in addition to, not a replacement for, the firm-wide `AUDIT` BullMQ queue used for cross-cutting security events (login, permission changes).
- **Permission checks** — every route gated by `requirePermission`/`requireAnyPermission` per §6/§7; approval-type actions (`tasks:approve`, `tasks:time_approve`) additionally enforce a **four-eyes check** in the service layer (approver ≠ actor who did the work), which a route-level permission check alone cannot express.
- **Soft delete** — standard `deletedAt`/`deletedBy`, with the added state-based guard that completed/billed entities refuse deletion regardless of permission (§10 rule 2, 11).
- **Optimistic locking** — **not currently implemented anywhere in the codebase** (verified: no `version` field or concurrency check exists in `BaseRepository` today). This module needs it: multiple staff can edit the same task/project concurrently (status change + reassignment racing). Rather than special-casing this module, propose extending `BaseRepository` with an **opt-in** `version` column check (only enforced when the entity defines one) so this becomes reusable shared infrastructure without touching any existing module's behavior — existing modules that don't add a `version` column are unaffected.
- **Concurrency** — lifecycle transitions (§5) and rollup recalculations (progress %, milestone weights) are wrapped in a single DB transaction (`BaseService.transaction()`) so a status change and its resulting activity/notification/progress-update are atomic.

---

## 17. Deliverables

This document is the complete architecture specification for the Projects (Engagements) and Task Management module: objectives, folder structure, data model, relationships, lifecycles, permissions, API surface, service/repository responsibilities, business rules, events, background jobs, dashboard integration, future-proofing hooks, testing strategy, and security posture.

No code, Prisma schema, controllers, or repositories have been generated. This is ready for review and sign-off before implementation begins.
