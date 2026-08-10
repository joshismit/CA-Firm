# Client Task Assignment & Firm-Wide Task Visibility — Audit Report

> Status: **Audit only — no code changed.** This document is the required pre-implementation audit for the "Client creates a task and assigns it to an eligible CA/staff member; task becomes visible to authorized staff firm-wide" feature. Implementation must not start until the open decisions in §8 are resolved.

Scope of this audit: `Task`/`TaskService`/`TaskRepository`/`TaskAccessScopeService`, `Business`/`Client`/`Contact`/staff-assignment relationships, `AuthService.resolveRole()`/RBAC/tenant isolation, `AuditLogRecorder`/`NotificationDispatchService`, and the frontend task/client UI. All findings below are from direct inspection of `backend/prisma/schema.prisma`, `backend/src/**`, and `frontend/src/**` on branch `dev`.

---

## 1. Task domain — what already exists

### 1.1 `Task` model (`backend/prisma/schema.prisma:1578`)

Deliberately minimal by design (schema header: *"no TaskAssignment/TaskDependency/TaskLabel satellite tables... `assigneeId` is a single nullable FK... per explicit instruction, no milestones, comments, activities, or time tracking"*).

Relevant fields: `tenantId` (scalar, no relation), `businessId`, `contactId`, `clientId`, `documentId`, `folderId`, `projectId`, `leadId` — **all independent, optional FKs, nothing enforces they agree**; `assigneeId` (single scalar FK to `User`, **no multi-assignee, no join table**); `createdBy`/`deletedBy`/`completedBy`/`approvedBy`/`rejectedBy` (all `User?` FKs); `status` (`TaskStatus`), `type` (`TaskType?`), `priority` (`TaskPriority?`); `startDate`/`dueDate`/`completedAt`.

`TaskStatus` already contains both lifecycles: simple (`TODO`/`IN_PROGRESS`/`REVIEW`/`COMPLETED`/`CANCELLED`) and approval-workflow (`REQUESTED`/`SUBMITTED`/`UNDER_REVIEW`/`APPROVED`/`REJECTED`). `TaskType` (`DOCUMENT_REQUEST`/`FILING`/`COMPLIANCE`/`PAYMENT_FOLLOW_UP`/`DOCUMENT_REVIEW`/`APPROVAL`) is what selects the lifecycle: **`initialStatus = dto.type ? REQUESTED : TODO`** (`task.service.ts:174`). A client-created task should set `type` so it enters the approval workflow.

### 1.2 `TaskService` (`backend/src/modules/tasks/service/task.service.ts`)

Full CRUD + lifecycle wrapper methods already exist: `createTask`, `updateTask`, `assignTask` (thin wrapper over `updateTask`), `updateTaskStatus`, `submitTask`/`approveTask`/`rejectTask`/`completeTask`/`reopenTask`, `getTaskById`, `listTasks`, `getTasksByProject`/`getTasksByLead`/`getTasksByAssignee`, `getOverdueTasks`, `getPendingReviewTasks`.

- `createTask` forces `createdBy = this.userId` server-side (never client-suppliable) — good, this is exactly the "don't trust client-supplied IDs" property required by §4 of the brief. It does **not** currently do any ownership/eligibility check on `assigneeId` — any caller holding `tasks:create` can set it to any user ID in the DTO.
- A full status state machine (`ALLOWED_TRANSITIONS`) already enforces valid transitions and required-reason fields; reused as-is, no changes needed.
- `TASK_CREATED` audit + IN_APP "Task assigned" notification already fire automatically when `assigneeId` is set on create (see §4/§5) — **a client-creates-and-assigns-task call into the existing `createTask()` already gets audit + notification for free.**

### 1.3 `TaskRepository` (`backend/src/modules/tasks/repository/task.repository.ts`)

Extends `BaseRepository`, inherits tenant+soft-delete scoping via `applyFilters()` (hard runtime throw if `tenantId` omitted — cannot silently leak). Existing finders: `findByStatus`, `findByProject`, `findByLead`, `findByAssignee`, `findOverdue`, `findPendingReview`, `search` (the general list/filter method, ANDs an optional `scopeWhere`), `findForGlobalSearch`.

**Gap:** no `findByBusiness`/`findByClient`/`findByContact`, and `TaskSearchFilters`/`listTasksQuerySchema` don't expose `businessId`/`clientId`/`contactId` as filters — needed if the client UI should filter/list "my tasks" by client identity rather than only by `assigneeId`/`createdBy`.

### 1.4 `TaskAccessScopeService` (`backend/src/modules/tasks/service/task-access-scope.service.ts`) — the crux of the feature

Full file (81 lines):

```ts
resolve(user: RequestUser): TaskAccessScope {
  const unrestricted =
    user.role === UserRole.MASTER_ADMIN ||
    user.role === UserRole.TENANT_ADMIN ||
    user.permissions.includes(TASK_PERMISSIONS.MANAGE) ||
    user.permissions.includes(TASK_PERMISSIONS.REVIEW) ||
    user.permissions.includes(TASK_PERMISSIONS.APPROVE);
  return unrestricted ? {} : { userId: user.id };
}
static assertAllowed(task, scope) { /* assigneeId === scope.userId || createdBy === scope.userId, else 403 */ }
static toWhereInput(scope) { /* { OR: [{assigneeId: scope.userId}, {createdBy: scope.userId}] } */ }
```

**Current behavior — this is exactly the gap the business requirement is asking to close:**
- Tenant-wide visibility today is granted only to `MASTER_ADMIN`/`TENANT_ADMIN`, or anyone holding `tasks:manage`/`tasks:review`/`tasks:approve`.
- Plain `STAFF` (CA Amit, CA Priya in the example, if they only hold `tasks:read`) is restricted to `assigneeId === self OR createdBy === self` — **so today, CA Amit cannot see CA Rahul's task.** This is precisely what §8 of the brief asks to change.
- `UserRole.CLIENT` has **no branch at all** — it's treated identically to `STAFF` (restricted to own assignee/creator rows). There's no notion of "tasks belonging to my Business/Client."
- Applied only to reads (`getTaskById`, `listTasks`, `getOverdueTasks`, `getPendingReviewTasks`); `getTasksByProject`/`getTasksByLead` bypass it entirely (pre-existing inconsistency, not caused by this feature, worth flagging but out of scope to fix unless it intersects). Mutations are never scoped by it — deliberately, so a reviewer/approver can act on a task they neither created nor are assigned to. This visibility/modification separation is exactly what §8 of the brief also asks to preserve.

The sibling `DocumentAccessScopeService` (`backend/src/modules/documents/service/document-access-scope.service.ts`) already implements a real CLIENT branch, and is the pattern to mirror:
```ts
async resolve(user) {
  if (UNRESTRICTED_COARSE_ROLES.includes(user.role)) return {};
  return user.role === UserRole.CLIENT
    ? this.resolveClientScope(user.id, user.tenantId)   // Contact.portalUserId -> ContactRole -> businessId[]
    : this.resolveStaffScope(user.id, user.tenantId);   // BusinessAssignmentRepository.findBusinessIdsForUser()
}
```
`TaskAccessScopeService` should be **extended** (not replaced) to grow this same shape.

### 1.5 Routes/DTOs/Permissions

All 17 existing routes (`backend/src/modules/tasks/routes/task.routes.ts`) already chain `authMiddleware → tenantMiddleware → requirePermission(...) → validate(...)`. All 10 `TASK_PERMISSIONS` codes already exist and are seeded (`tasks:create/read/update/delete/manage/export/approve/assign/review/complete`) — **no new permission codes are needed.** `POST /tasks/:id/assign` (permission `tasks:assign`) already exists and validates `{ assigneeId: uuid }`.

**Gaps:** `createTaskSchema`/`CreateTaskDto` has no way to distinguish a client-originated task; `TaskResponseDto`/`TaskMapper` omit `createdBy` from the API response (present on the model, invisible over the wire) — needed if the UI should show "Created By."

---

## 2. Business / Client / Contact — existing staff-assignment relationships

### 2.1 Models

- **`Business`** (`schema.prisma:953`) — the firm's customer entity, tenant-scoped. Has a `Client?` (1:1), `assignments: BusinessAssignment[]`, `contactRoles`, `tasks`, etc.
- **`Client`** (`schema.prisma:1253`) — a thin, **1:1 wrapper over `Business`** (`Client.businessId` is `@unique`), carrying onboarding status (`ClientStatus`: ACTIVE/INACTIVE/SUSPENDED/FORMER), category, `assignments: ClientAssignment[]`, `projects`, `invoices`, `tasks`. A `Business` can exist without a `Client` row (pre-conversion); at most one `Client` per `Business`.
- **`Contact`** (`schema.prisma:1134`) — an individual person, tenant-scoped, linked to Businesses only indirectly via `ContactRole` (junction: `contactId` + `businessId` + role type, e.g. DIRECTOR/PARTNER/AUTHORIZED_SIGNATORY). Has `portalUserId String? @unique` — an **optional 1:1 pointer from Contact → User**, intended to represent "this contact has a client-portal login."

### 2.2 Existing staff↔business/client assignment — **reuse this, don't invent a new one**

| Model | Status | Wired up? |
|---|---|---|
| `BusinessAssignment` (User ⇄ Business, many-to-many, free-text `role` field) | **Fully implemented and actively used.** Repository (`business-assignment.repository.ts`: `findBusinessIdsForUser`, `findByBusiness`, `findExisting`), service CRUD (`listBusinessAssignments`, `assignBusinessUser`, `unassignBusinessUser`, audit-logged), REST endpoints (`GET/POST /business/:id/assignments`, `DELETE /business/:id/assignments/:userId`), and **already consumed as an authorization scope** by `DocumentAccessScopeService.resolveStaffScope()` and by the dashboard's "Assigned Businesses/Clients" widgets. | ✅ Reuse directly |
| `ClientAssignment` (User ⇄ Client, structurally identical mirror) | **Defined in schema only — zero references anywhere in `backend/src`.** No repository, service, controller, or route. Dead/unimplemented. | ⚠️ Exists as schema but unbuilt |
| `LeadAssignment` | Fully implemented, but scoped strictly to pre-conversion `Lead`s (CRM module) — not relevant post-conversion. | N/A for this feature |

**No `dedicatedCaId`/`accountManagerId`/`relationshipManagerId`/`ownerId` field exists anywhere.** "Relationship Manager"/"Accountant"/"Auditor"/"Reviewer" are just free-text values stored in `BusinessAssignment.role`. There is no single-primary-CA concept on Business/Client (unlike `LeadAssignment.isPrimary` on the CRM side) — `BusinessAssignment` treats all assigned staff as peers.

**Implication:** since `Client.businessId` is unique/1:1 with `Business`, "staff eligible to be assigned this client's tasks" = `BusinessAssignmentRepository.findByBusiness(client.businessId)` — **no schema change needed** to resolve this relationship. The unbuilt `ClientAssignment` table is a secondary option only if the feature explicitly wants Client-level (not Business-level) staff scoping — see open decision in §8.

### 2.3 `Contact.portalUserId` — the client-login linkage is schema-only

Grep across the whole backend found exactly **4 references** to `portalUserId`, and only one is functional:
```ts
// document-access-scope.service.ts — the ONLY place that reads it
private async resolveClientScope(userId: string, tenantId: string) {
  const contact = await this.contactRepository.findFirst({ portalUserId: userId }, { tenantId });
  if (!contact) return { businessIds: [] };
  const roles = await this.contactRoleRepository.findByContact(contact.id, { tenantId });
  return { businessIds: [...new Set(roles.map(r => r.businessId))], ownContactId: contact.id };
}
```
**No code anywhere creates this link.** `contact.req.dto.ts` doesn't accept `portalUserId` on create/update; no service, controller, or auth-module code ever sets it. This is aspirational schema plumbing, not a working feature.

---

## 3. Auth / RBAC / Tenant isolation — CLIENT role readiness

### 3.1 `UserRole.CLIENT` is defined but dead

`backend/src/shared/enums/user.enum.ts` defines `MASTER_ADMIN | TENANT_ADMIN | MANAGER | STAFF | CLIENT`. **Important structural fact: `User` has no `role` column in the database at all.** The coarse role is derived fresh at every login/refresh by `AuthService.resolveRole()`:

```ts
// auth.service.ts:645
private resolveRole(user: User): UserRole {
  if (user.isOwner) return UserRole.TENANT_ADMIN;
  if (user.isManager) return UserRole.MANAGER;
  return UserRole.STAFF;
}
```

**There is no branch that can ever produce `CLIENT`.** No seeded `Role`/`RolePermission` rows exist for a "Client" persona anywhere (`prisma/seeds/dev-data.seed.ts` seeds only "Owner"/"Staff"). Real fine-grained authorization comes from a **separate** `Role → RolePermission → Permission` DB table set (unrelated to the `UserRole` TS enum despite the naming collision), resolved into a flat `permissions: string[]` baked into the JWT — this part is completely role-agnostic and needs zero changes.

### 3.2 What's actually generic and reusable as-is

- `requirePermission()`/`requireAnyPermission()` (`backend/src/middlewares/permission.middleware.ts`) — pure `req.user.permissions.includes(...)` checks, no DB roundtrip, **completely role-agnostic**. Works for CLIENT the moment CLIENT has permissions.
- `tenantMiddleware` + `BaseRepository.applyFilters()` — tenant scoping is enforced as a hard throw if `tenantId` is omitted from any query; **fully generic, no CLIENT-specific work needed.**
- The JWT/session/login code path itself (`login()`, `refresh()`, `UserSession`/`RefreshToken` handling) is not STAFF/CLIENT-specific — a CLIENT user, once `resolveRole()` can produce it, gets a completely normal session.

### 3.3 What's missing (the real gap)

1. `resolveRole()` has no signal to resolve CLIENT (needs e.g. "does this User have a linked `Contact.portalUserId`?").
2. No `Role`/`RolePermission` rows exist for a Client persona — needs seeding (e.g. a "Client" role granting `tasks:create`, `tasks:read`, `tasks:assign`).
3. No provisioning flow links a `User` row to `Contact.portalUserId` — nothing today creates a client-portal login at all (no invite-a-client endpoint).
4. `TaskAccessScopeService` has no CLIENT branch (§1.4).

### 3.4 Existing tenant-isolation test pattern (to be reused, not reinvented)

`backend/tests/integration/modules/tasks/task.routes.spec.ts` already has the canonical pattern: `tokenForTenantA`/`tokenForTenantB` helpers mint real JWTs (role-agnostic — **tests can already mint a `role: CLIENT` token today** since the signing helper accepts an arbitrary role), and a `describe('tenant isolation', ...)` block asserts cross-tenant `GET /tasks/:id` → **404** (not 403 — the row is invisible, not merely forbidden) and cross-tenant list-exclusion. New tests should follow this exact convention, added to `task.routes.spec.ts` (or a sibling spec), not a new cross-cutting suite.

---

## 4. Audit logging — already sufficient, no new event types needed

`AuditEventType.TASK_CREATED` and `TASK_ASSIGNED` already exist and are already fired by `TaskService`:
- `createTask()` fires `TASK_CREATED` (not `TASK_ASSIGNED`, even if `assigneeId` is set at creation — by design, per the enum's own doc comment).
- `updateTask()`'s reassignment branch (and `assignTask()`, which wraps it) fires `TASK_ASSIGNED` on any genuine assignee change.

No `CLIENT_TASK_CREATED` or other client-specific audit event exists anywhere in the schema, and grepping confirms no client-portal audit events exist at all. **Recommendation: reuse `TASK_CREATED`/`TASK_ASSIGNED` as-is** (the brief explicitly allows this: *"reuse existing TASK_CREATED / TASK_ASSIGNED events if they already adequately represent these operations"*) — the `actorId` on the audit row already distinguishes who performed the action; a new event type isn't needed unless the team wants to filter "client-originated" audit rows specifically (open decision, §8).

`AuditLogRecorder.record()` accepts a `metadata` JSON field that `TaskService` currently never populates (only `description` free text) — worth adding structured metadata (assigneeId, previous assignee, businessId/clientId) on this feature's audit calls, matching the brief's ask for "actor, tenant, task, client, assignee" in metadata.

---

## 5. Notifications — already sufficient, no new engine needed

`NotificationDispatchService.send()` already exists, already used by `TaskService.notify()` (private helper, IN_APP-only), and already fires on:
- `createTask()` when `assigneeId` is set and isn't the actor themself ("Task assigned" / `"You were assigned the task ...”`).
- `updateTask()`'s reassignment branch (same copy).
- `updateTaskStatus()` (status-change copy).

**A client-creates-and-assigns-task flow that goes through the existing `TaskService.createTask()` with `assigneeId` set in the DTO already gets an IN_APP notification to the assignee for free — zero new notification wiring required for the happy path.** EMAIL is a real, configured channel (nodemailer-backed) if IN_APP-only isn't sufficient; WHATSAPP/SMS providers exist as unconfigured scaffolding (no env vars set anywhere) and are correctly out of scope per the brief.

---

## 6. Frontend — what exists today

The frontend (`frontend/src/`, React 19 + Vite + TanStack Query) has a real, working task list/detail UI at `frontend/src/modules/tasks/`, but it is **staff-only and incomplete**:

- **List (`TasksPage.tsx`)** and **detail (`TaskDetailPage.tsx`)** pages exist and hit the real backend. List shows title/description/status/due-date only — no Assigned To, Created By, Client, or Priority columns rendered anywhere.
- **No task creation UI exists** — `useCreateTaskMutation`/`createTaskSchema` are fully defined but never imported by any component; the "New Task" button on `TasksPage` has no `onClick` handler.
- **No staff/assignee picker exists anywhere in the app** — every assignment field (task detail's "Reassign," `ProjectForm`'s "Manager ID") is a raw free-text UUID `<input>`. `GET /users` already exists and is wired (`useUsersQuery`), so a picker can be built on top of it without new backend work, but the component itself doesn't exist yet.
- **A `/portal` client-portal route/layout skeleton exists** (`ClientPortalLayout`, mounted at `/portal`) but its API layer is entirely stubbed (every call throws `501 NOT_IMPLEMENTED`), has no task route, and is guarded only by a generic `isAuthenticated` check (not role-specific). A settings-page comment in the codebase itself states: *"AuthService.resolveRole() on the backend only ever assigns TENANT_ADMIN or STAFF today"* — confirming the frontend team is already aware CLIENT/MANAGER aren't issued yet.
- **Architectural convention to respect:** the frontend has a hard rule against branching UI on role names — everything gates on permission strings via `<Can permission="tasks:create">` / `usePermission()`. This means once the backend grants CLIENT the right permissions, the existing "New Task" button's `<Can>` gate will "just work" for visibility — no frontend role-branching should be added.

---

## 7. Gap analysis — required capability vs. existing support

| Requirement (from brief) | Existing support | Gap |
|---|---|---|
| Task belongs to tenant/business/client/contact, has creator + assignee | ✅ Full support (`Task.tenantId/businessId/clientId/contactId/createdBy/assigneeId`) | None |
| Client creates task via existing `TaskService.createTask()` | ✅ Reusable as-is; `createdBy` already server-derived | Needs: eligibility check on `assigneeId`, and possibly forcing `clientId`/`businessId` server-side from the caller's own Contact (see §3.3/§8) |
| Staff (Amit/Priya/Manager) sees tasks assigned to another CA in the same tenant | ❌ `TaskAccessScopeService` currently restricts plain STAFF to assignee-or-creator only | **Must extend** `TaskAccessScopeService.resolve()` |
| Visibility ≠ modification rights | ✅ Already true — mutations are gated by `requirePermission()` only, `TaskAccessScopeService` only gates reads | None — just don't couple these when extending |
| Client sees only own client's tasks | ❌ CLIENT has no branch in `TaskAccessScopeService` at all | **Must add** a CLIENT branch, mirroring `DocumentAccessScopeService.resolveClientScope()` |
| Client identity resolved server-side, not trusted from request body | ⚠️ Pattern exists (`Contact.portalUserId → ContactRole → businessId[]`) but nothing wires a CLIENT `User` to a `Contact` yet | **Must build**: resolve `req.user.id → Contact.portalUserId → businessId/clientId`, and use that (not client-supplied `clientId`) to scope create/read |
| `GET /tasks/assignable-staff` | ❌ Does not exist | **Must add** — thin new endpoint/service method returning `BusinessAssignmentRepository.findByBusiness(client.businessId)` staff, minus secrets |
| Eligible-assignee validation on assign | ❌ Not enforced anywhere today (`assignTask` accepts any `assigneeId`) | **Must add**: assignee.tenantId === task.tenantId + (assignee ∈ BusinessAssignment for that business, or ∈ tenant staff — open decision) |
| CLIENT role can actually authenticate | ❌ `resolveRole()` cannot produce CLIENT; no Role/RolePermission seeded; no provisioning flow | **Must build**: minimal `resolveRole()` branch + seed a Client role + minimal way to link a User to a Contact |
| Audit CLIENT_TASK_CREATED / TASK_ASSIGNED | ✅ `TASK_CREATED`/`TASK_ASSIGNED` already fire automatically via existing `TaskService` | None required; optionally add structured `metadata` |
| Notification to assignee on assignment | ✅ Already fires automatically via existing `TaskService.notify()` | None |
| Tenant isolation | ✅ Fully generic already (`BaseRepository`, `tenantMiddleware`) | None |
| `GET /tasks/:id` 404s for cross-tenant/unauthorized | ⚠️ Cross-tenant already 404s (`BaseRepository`); cross-*client*-same-tenant needs the new CLIENT scope branch to also 404/403 correctly | Covered once CLIENT branch is added |
| Frontend: client task creation, staff picker, task list columns | ❌ None of this exists in the frontend today | **Must build** (net-new UI, no existing component to extend beyond the API client layer) |

---

## 8. Open decisions requiring your input before implementation

These are genuine design forks the audit surfaced — the brief gives direction but leaves the specific mechanism to be chosen. Implementation will start once these are resolved (see the question I'm asking alongside this report).

1. **Which table identifies "eligible staff for this client": `BusinessAssignment` (already fully built, reuse now) or building out the dormant `ClientAssignment` table?** Since `Client.businessId` is 1:1 with `Business`, `BusinessAssignment` already answers "who is assigned to this client's business" with zero schema change. `ClientAssignment` is schema-only today and would need a full repository/service/route built from scratch (essentially duplicating `BusinessAssignment`) for no additional capability given the 1:1 relationship — I'd recommend reusing `BusinessAssignment` unless there's a reason to distinguish "assigned to the Business" from "assigned to the Client" as different concepts in this firm's workflow.

2. **What happens when a Business has zero `BusinessAssignment` rows?** (i.e. no staff has been explicitly assigned to that client yet.) Should `GET /tasks/assignable-staff` fall back to "all tenant staff," or return empty (forcing an admin to assign staff to the business first)? This affects both the assignable-staff endpoint and the assignment-eligibility check on `POST /tasks/:id/assign`.

3. **How does a CLIENT-role `User` get created and linked to a `Contact` in the first place?** No invite/signup flow exists today. Minimal options: (a) a Tenant Admin manually creates a `User` + sets `Contact.portalUserId` via a small new admin action, or (b) a full self-service client invite/signup flow. The brief says to build "the minimum authentication/authorization support necessary" — I'd recommend (a), since a full invite flow is a separate, larger feature.

4. **Should staff tenant-wide visibility be tied to the `TASKS_READ` permission alone, or should it also depend on `BusinessAssignment` (i.e., a CA only sees tasks for businesses they're assigned to, not literally every task in the tenant)?** The brief's example (Amit/Priya see Rahul's task with no mention of them being assigned to that client) reads as **tenant-wide for any staff holding `tasks:read`**, which is simpler and is what I'd implement by default — but this is worth confirming since it's a meaningful visibility-scope decision.

---

## 8a. Decisions (confirmed by product owner, 2026-08-10)

1. **Staff eligibility source:** reuse `BusinessAssignment` (via `Client.businessId → Business`). Do **not** build out `ClientAssignment`.
2. **No-assignment fallback:** if a Business has zero `BusinessAssignment` rows, `GET /tasks/assignable-staff` falls back to all active tenant staff.
3. **Client provisioning:** minimal admin-triggered linking — a Tenant Admin/staff action sets `Contact.portalUserId` on an existing Contact (no self-service invite/signup flow in this phase).
4. **Visibility scope:** tenant-wide staff visibility depends only on holding `tasks:read` (or the existing unrestricted set) — not additionally gated by `BusinessAssignment`.

---

## 9. What will NOT be touched (confirmed unnecessary by this audit)

- No second `Task`/`ClientTask` model — the existing `Task` model already has every FK needed.
- No new `TaskAssignment`/multi-assignee schema — single `assigneeId` already fits "assign to one CA."
- No new RBAC permission codes — all 10 `TASKS` permission codes already exist and are seeded.
- No new audit event types — `TASK_CREATED`/`TASK_ASSIGNED` already exist and already fire.
- No new notification engine/provider — `NotificationDispatchService` + IN_APP already fires on assignment automatically.
- No changes to `tenantMiddleware`/`BaseRepository`/`requirePermission` — already fully generic and tenant-safe.
- No changes to the Task status/lifecycle state machine — reused as-is.
