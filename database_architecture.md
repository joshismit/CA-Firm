# CA Firm ERP — PostgreSQL Database Architecture Blueprint
> Principal Database Architect Design | Production-Grade Multi-Tenant SaaS | PostgreSQL 16 + Prisma ORM
> Designed for 10-year lifecycle · Thousands of tenants · Millions of records

---

## Part 1 — Database Design Philosophy

### 1.1 Normalization Strategy

The schema targets **Third Normal Form (3NF)** as the baseline, with deliberate **selective denormalization** for read performance on high-traffic tables.

**Normalization Decisions:**

| Decision | Rationale |
|---|---|
| 3NF across all transactional tables | Eliminate data anomalies, maintain integrity |
| Enum columns for finite state sets | Avoid lookup table joins on hot paths |
| JSONB columns for polymorphic metadata | Avoid EAV anti-pattern, retain queryability |
| Materialized counts on tenant stats | Avoid expensive COUNT(*) on large tables |
| Denormalized `tenantId` on every row | Enables single-column partition and RLS |

**When to Denormalize:**
- Notification delivery status → cached counter on notifications table
- Task completion counts on projects → updated via trigger
- Subscription status on tenants → cached to avoid join on every request

---

### 1.2 Why PostgreSQL

| Feature | Value for this Platform |
|---|---|
| **JSONB** | Stores flexible metadata (custom fields, settings) without schema changes |
| **Row Level Security (RLS)** | Native tenant isolation at the database engine level |
| **Partitioning** | Table partitioning on `created_at` for audit logs, notifications |
| **Full-Text Search** | Native `tsvector` / `tsquery` for document and contact search |
| **Concurrent Indexes** | Zero-downtime index creation on production tables |
| **LISTEN/NOTIFY** | Real-time event push without polling (future use) |
| **CTEs & Window Functions** | Complex reporting queries without application-level aggregation |
| **Transactional DDL** | Safe schema migrations inside transactions |
| **pg_trgm Extension** | Fuzzy search for client names, PAN numbers |
| **uuid-ossp / gen_random_uuid()** | Native UUID generation |

---

### 1.3 Multi-Tenant Database Strategy

**Strategy: Shared Database, Shared Schema with Row-Level Tenant Isolation**

Every tenant's data lives in the same tables. Every table that contains tenant-specific data carries a `tenant_id UUID NOT NULL` column. This column is indexed, foreign-keyed to the `tenants` table, and enforced at every query level via Prisma's `where` clause and PostgreSQL's Row Level Security policies.

**Why not separate schemas or separate databases?**

| Approach | Verdict | Reason |
|---|---|---|
| Separate database per tenant | ❌ Rejected | Operationally impossible at scale; 1000 tenants = 1000 DB connections |
| Separate schema per tenant | ❌ Rejected | Schema migrations become O(n tenants); maintenance nightmare |
| Shared schema + `tenant_id` | ✅ Chosen | Scales to millions of rows; single migration; industry standard for SaaS |

**Defense Layers:**

1. **Application Layer** — Prisma query always includes `tenantId` filter
2. **Middleware Layer** — `tenant.middleware.ts` enforces `req.tenant` context
3. **Database Layer** — PostgreSQL RLS policies as a safety net
4. **Repository Layer** — `BaseRepository` enforces `tenantId` on all CRUD operations

---

### 1.4 UUID vs Auto-Increment

**Decision: UUID v4 for all primary keys.**

```
id UUID DEFAULT gen_random_uuid() PRIMARY KEY
```

**Rationale:**

| Concern | UUID | Auto-Increment |
|---|---|---|
| Predictability | ✅ Not guessable | ❌ Sequential, exploitable |
| Merge/Federation | ✅ Globally unique | ❌ ID collisions across DBs |
| Distributed systems | ✅ IDs generated anywhere | ❌ Requires DB roundtrip |
| Tenant data export | ✅ IDs survive migration | ❌ IDs may conflict on import |
| Index performance | ⚠️ Slightly larger (16 bytes) | ✅ Smaller (4–8 bytes) |
| URL exposure | ✅ Safe to expose | ❌ Reveals volume |

**Performance mitigation for UUID indexes:**
- Use `gen_random_uuid()` (v4) — PostgreSQL 13+ native, no extension needed
- For high-insert append-only tables (audit logs), use `ULID` pattern via a generated column to maintain index locality

---

### 1.5 Soft Delete Strategy

**Decision: `deleted_at TIMESTAMPTZ NULL` on all business-critical entities.**

```
deleted_at  TIMESTAMPTZ  NULL  -- NULL = active, timestamp = soft-deleted
deleted_by  UUID         NULL  -- FK to users.id — who deleted it
```

**Entities that use soft delete:**
- `tenants`, `users`, `clients`, `contacts`, `documents`, `tasks`, `leads`

**Entities that do NOT use soft delete (immutable records):**
- `audit_logs`, `login_history`, `invoices`, `payments`, `notification_logs`

**Filtering pattern:** Every Prisma query on soft-deleted tables must include `where: { deletedAt: null }`. The `BaseRepository` enforces this by default.

**Hard delete exceptions:** System-triggered cleanup of expired sessions, OTPs, and temporary tokens after TTL.

---

### 1.6 Auditing Strategy

**Two-tier audit system:**

**Tier 1 — Structured Audit Log (Database)**
For all write operations on business entities: Create, Update, Delete, Restore.

```
audit_logs table:
- id, tenant_id, user_id, action, resource, resource_id
- old_data JSONB, new_data JSONB
- ip_address, user_agent, correlation_id
- created_at
```

**Tier 2 — Login & Access History (Database)**
Separate table for authentication events: login, logout, failed attempts, token refresh, MFA events.

**What is NOT stored in audit logs:**
- Read operations (SELECT) — too noisy; use access logs at Nginx/application level
- Background worker operations — logged to application logs (Pino) not DB

---

### 1.7 Index Strategy

**Primary Index Types Used:**

| Type | Use Case |
|---|---|
| B-Tree (default) | `tenant_id`, `user_id`, `status`, `created_at`, email, UUID PKs |
| Composite B-Tree | `(tenant_id, status)`, `(tenant_id, created_at)`, `(tenant_id, user_id)` |
| Partial B-Tree | `WHERE deleted_at IS NULL`, `WHERE status = 'ACTIVE'` |
| GIN | JSONB columns (`metadata`, `custom_fields`), full-text search vectors |
| GiST | Full-text `tsvector` columns, trigram search |
| Hash | Exact-match lookups on UUID foreign keys (Postgres 10+) |
| BRIN | Time-series tables partitioned by `created_at` (audit logs, notifications) |

**Mandatory Indexes on Every Tenant Table:**
```
INDEX ON (tenant_id)
INDEX ON (tenant_id, created_at DESC)
INDEX ON (tenant_id, deleted_at) WHERE deleted_at IS NULL
```

---

### 1.8 Scalability Strategy

**Phase 1 (0–50K tenants):** Single PostgreSQL primary with read replica. Connection pooling via PgBouncer in transaction mode.

**Phase 2 (50K–500K tenants):** Read replicas per geographic region. Prisma `$queryRaw` for reporting queries directed to replica.

**Phase 3 (500K+ tenants):** Table partitioning by `tenant_id` hash range. Citus extension for horizontal sharding if needed.

**Immediate scalability decisions baked into the schema:**
- All large tables partitioned by `created_at` (RANGE partitioning)
- Audit logs partitioned monthly
- Notification queue uses BRIN indexes (sequential append-only)
- `pg_partman` extension for automated partition management
- Archival strategy: records older than 7 years moved to cold storage tables

---

## Part 2 — Module-Wise Database Design

### 2.1 Master Admin Module

**Purpose:** Platform-level administration. Manages all tenants, monitors platform health, controls billing plans, and enforces global policies. Operates above tenant scope.

**Main Entities:** `master_admins`, `platform_settings`, `platform_audit_logs`

**Relationships:** Master admin → manages many tenants. Platform settings → global singleton row.

**Ownership:** Platform (no tenant_id)

**Tenant Scope:** Global — never filtered by tenant_id. These records are accessible only to master admins.

---

### 2.2 Multi-Tenant Module

**Purpose:** Core tenant lifecycle management. Handles provisioning, activation, suspension, and deactivation of CA firms as tenants.

**Main Entities:** `tenants`, `tenant_configs`, `tenant_onboarding_steps`

**Relationships:** One tenant → many users, many roles, many clients, many documents. Tenant → has one config, one billing subscription.

**Ownership:** Platform (tenants table is system-scoped)

**Tenant Scope:** The `tenants` table itself is global. All other tables reference `tenant_id`.

---

### 2.3 Authentication Module

**Purpose:** Handles all identity verification — login, logout, token lifecycle, OTP, MFA, password reset, account lockout.

**Main Entities:** `user_sessions`, `refresh_tokens`, `otp_codes`, `password_reset_tokens`, `login_history`, `mfa_configs`

**Relationships:** User → has many sessions, many refresh tokens, many OTPs, one MFA config.

**Ownership:** User-scoped, tenant-scoped

**Tenant Scope:** `tenant_id` required on all auth tables to allow multi-tenant session isolation.

---

### 2.4 Users Module

**Purpose:** Stores all user profiles within a tenant — firm partners, managers, staff, and external collaborators.

**Main Entities:** `users`, `user_profiles`, `user_invitations`

**Relationships:** User → belongs to tenant, has many roles, has one profile. User → created by another user (self-referential for invitations).

**Ownership:** Tenant-scoped

**Tenant Scope:** Every user belongs to exactly one tenant. Cross-tenant access is not permitted.

---

### 2.5 Roles & Permissions Module

**Purpose:** Flexible RBAC. Roles are defined per tenant. Permissions are system-defined. Role-permission mapping is flexible.

**Main Entities:** `roles`, `permissions`, `role_permissions`, `user_roles`, `permission_groups`

**Relationships:** Role → belongs to tenant, has many permissions through `role_permissions`. User → has many roles through `user_roles`.

**Ownership:** Permissions are system-global. Roles are tenant-scoped.

**Tenant Scope:** `roles` and `user_roles` require `tenant_id`. `permissions` and `permission_groups` are global/system tables.

---

### 2.6 Businesses Module

**Purpose:** Central entity registry for all business entities that the CA firm manages — companies, LLPs, trusts, individuals (HUF, individual, proprietorship, etc.).

**Main Entities:** `businesses`, `business_types`, `business_addresses`, `business_contacts`, `business_documents`, `business_assignments`

**Relationships:** Business → has one type, many addresses, many contacts, many documents. Business → assigned to multiple users.

**Ownership:** Tenant-scoped

**Tenant Scope:** `tenant_id` required on `businesses`, `business_addresses`, `business_contacts`, `business_documents`, `business_assignments`.

---

### 2.7 Contacts Module

**Purpose:** Person-level contact registry. Contacts can be directors, partners, trustees, signatories, or any individual linked to a business.

**Main Entities:** `contacts`, `contact_roles`, `contact_addresses`, `contact_documents`

**Relationships:** Contact → has many roles across many businesses. Contact → may have many addresses and documents.

**Ownership:** Tenant-scoped

**Tenant Scope:** `tenant_id` required on all contact tables.

---

### 2.8 Clients Module

**Purpose:** The formal client relationship layer. A client is a business or contact that has a formal engagement with the CA firm. Clients can be linked to businesses or contacts.

**Main Entities:** `clients`, `client_groups`, `client_group_members`, `client_assignments`

**Relationships:** Client → maps to a business or contact. Client → belongs to optional client group. Client → assigned to users (relationship managers).

**Ownership:** Tenant-scoped

**Tenant Scope:** `tenant_id` required on all client tables.

---

### 2.9 CRM Module

**Purpose:** Sales pipeline and prospect management. Tracks potential new clients from lead to conversion.

**Main Entities:** `leads`, `lead_activities`, `lead_notes`, `pipelines`, `pipeline_stages`, `lead_stage_history`

**Relationships:** Lead → belongs to pipeline stage, has many activities and notes. Lead → assigned to user. Lead → can convert to client.

**Ownership:** Tenant-scoped

**Tenant Scope:** `tenant_id` required on all CRM tables.

---

### 2.10 Documents Module

**Purpose:** Full document lifecycle management — upload, version, organize, share, approve, retain.

**Main Entities:** `document_folders`, `document_categories`, `documents`, `document_versions`, `document_shares`, `document_approvals`, `document_retention_policies`

**Relationships:** Document → has many versions, one active version. Document → belongs to folder and category. Document → can be shared with users and external parties. Document → can be linked to clients, businesses, tasks.

**Ownership:** Tenant-scoped

**Tenant Scope:** `tenant_id` required on all document tables.

---

### 2.11 Tasks Module

**Purpose:** Work management and assignment system. Tasks can be standalone or linked to clients, documents, and CRM leads.

**Main Entities:** `tasks`, `task_comments`, `task_attachments`, `task_assignments`, `task_checklists`, `task_templates`, `task_time_logs`

**Relationships:** Task → has many comments, attachments, assignments, checklist items. Task → can have a parent task (subtasks). Task → linked to client, document, or lead.

**Ownership:** Tenant-scoped

**Tenant Scope:** `tenant_id` required on all task tables.

---

### 2.12 Notifications Module

**Purpose:** Multi-channel notification delivery system — in-app, email, SMS, push. Template-driven with delivery tracking.

**Main Entities:** `notification_templates`, `notifications`, `notification_preferences`, `notification_deliveries`, `notification_channels`

**Relationships:** Notification → created from template. Notification → delivered to user via one or more channels. Notification → linked to a resource (task, document, client).

**Ownership:** Templates are tenant-scoped. Notifications are user + tenant scoped.

**Tenant Scope:** `tenant_id` required on templates and notifications.

---

### 2.13 Billing & Subscriptions Module

**Purpose:** Full SaaS billing lifecycle — plans, features, subscriptions, trials, invoices, payments, usage limits.

**Main Entities:** `billing_plans`, `plan_features`, `subscriptions`, `invoices`, `invoice_line_items`, `payments`, `usage_records`

**Relationships:** Tenant → has one active subscription. Subscription → belongs to a plan. Plan → has many features. Subscription → generates monthly invoices. Invoice → has many payments.

**Ownership:** Plans and features are global/platform. Subscriptions, invoices, payments are tenant-scoped.

**Tenant Scope:** `billing_plans` and `plan_features` are global. All other billing tables require `tenant_id`.

---

### 2.14 Reports Module

**Purpose:** Report definitions, scheduling, and result storage. Reports can be user-triggered or scheduled.

**Main Entities:** `report_definitions`, `report_runs`, `report_results`, `saved_filters`

**Relationships:** Report definition → has many runs. Report run → has one result. Saved filter → belongs to user and report definition.

**Ownership:** Tenant-scoped

**Tenant Scope:** `tenant_id` required on all report tables.

---

### 2.15 Audit Module

**Purpose:** Immutable record of all system events for compliance, security review, and debugging.

**Main Entities:** `audit_logs`, `login_history`, `permission_change_logs`

**Relationships:** Audit log → references user, tenant, resource. Login history → references user, tenant, session.

**Ownership:** Tenant-scoped (with platform-level master audit for system operations)

**Tenant Scope:** `tenant_id` required. Platform-level audit (master admin actions) uses `tenant_id = NULL`.

---

### 2.16 Dashboard Module

**Purpose:** Configurable dashboard system with widgets, layouts, and saved filters per user.

**Main Entities:** `dashboard_layouts`, `dashboard_widgets`, `widget_preferences`, `saved_dashboard_filters`

**Relationships:** Dashboard layout → belongs to user, has many widgets. Widget preference → per-user per-widget config.

**Ownership:** User + tenant-scoped

**Tenant Scope:** `tenant_id` required.

---

### 2.17 Settings Module

**Purpose:** Hierarchical settings system — firm-level, team-level, and user-level configurations.

**Main Entities:** `firm_settings`, `user_settings`, `notification_settings`, `integration_settings`

**Relationships:** Firm settings → one per tenant. User settings → one per user per tenant. Integration settings → per tenant per integration type.

**Ownership:** Tenant-scoped (firm), User + tenant-scoped (user settings)

**Tenant Scope:** `tenant_id` required on all settings tables.

---

### 2.18 White Label Module

**Purpose:** Per-tenant branding customization — custom domain, logo, colors, fonts, SMTP relay, payment gateway keys.

**Main Entities:** `tenant_branding`, `custom_domains`, `smtp_configs`, `payment_gateway_configs`

**Relationships:** One-to-one relationship between tenant and branding/domain/SMTP/payment config.

**Ownership:** Tenant-scoped (platform manages the master domain registry)

**Tenant Scope:** `tenant_id` required, enforced as a unique constraint.

---

## Part 3 — Master Entity List

### Authentication

| Table | Purpose |
|---|---|
| `users` | All users across all tenants |
| `user_profiles` | Extended user profile data |
| `user_invitations` | Pending invitations sent to users |
| `user_sessions` | Active session tracking |
| `refresh_tokens` | JWT refresh token records |
| `otp_codes` | OTP for 2FA, email verification, phone verification |
| `password_reset_tokens` | Password reset flow tokens |
| `mfa_configs` | MFA method config per user (TOTP, SMS) |
| `login_history` | All login attempts (success + failure) |
| `account_lockouts` | Track and manage brute-force lockouts |

---

### Tenant Management

| Table | Purpose |
|---|---|
| `tenants` | CA Firm tenant registry |
| `tenant_configs` | Per-tenant configuration flags |
| `tenant_onboarding_steps` | Onboarding wizard progress tracking |
| `master_admins` | Platform super-admins (above all tenants) |
| `platform_settings` | Global platform configuration (singleton) |
| `platform_audit_logs` | Platform-level audit trail |

---

### Roles & Permissions

| Table | Purpose |
|---|---|
| `permissions` | System-defined permission registry |
| `permission_groups` | Logical grouping of permissions (e.g., Client Management) |
| `roles` | Tenant-defined roles |
| `role_permissions` | Many-to-many: roles ↔ permissions |
| `user_roles` | Many-to-many: users ↔ roles within a tenant |

---

### Businesses

| Table | Purpose |
|---|---|
| `business_types` | Lookup: Individual, LLP, Company, Trust, NGO, HUF, Society, etc. |
| `businesses` | Core business entity registry |
| `business_addresses` | Multiple addresses per business |
| `business_contacts` | Link businesses to contacts with roles |
| `business_documents` | Link documents to businesses |
| `business_assignments` | Assign staff to businesses |
| `business_identifiers` | PAN, TAN, GSTIN, CIN, LLPIN, etc. per business |
| `business_financial_years` | Track financial year periods per business |
| `business_compliance_status` | Track compliance obligation status |

---

### Contacts

| Table | Purpose |
|---|---|
| `contacts` | Individual person registry |
| `contact_roles` | Lookup: Director, Partner, Trustee, Signatory, etc. |
| `contact_addresses` | Multiple addresses per contact |
| `contact_identifiers` | PAN, Aadhaar, DIN, etc. per contact |
| `contact_documents` | Link documents to contacts |
| `contact_business_roles` | Many-to-many: contacts ↔ businesses with roles |

---

### Clients

| Table | Purpose |
|---|---|
| `clients` | Formal client engagement records |
| `client_groups` | Group related clients (family, group of companies) |
| `client_group_members` | Many-to-many: clients ↔ groups |
| `client_assignments` | Assign staff (relationship managers) to clients |
| `client_engagement_letters` | Track formal engagement letter status |
| `client_service_types` | Services opted by client (ITR, GST, Audit, etc.) |

---

### CRM

| Table | Purpose |
|---|---|
| `pipelines` | Sales pipeline definitions |
| `pipeline_stages` | Ordered stages within a pipeline |
| `leads` | Prospect records |
| `lead_activities` | Calls, meetings, emails, follow-ups per lead |
| `lead_notes` | Internal notes on a lead |
| `lead_stage_history` | Audit trail of stage transitions |
| `lead_assignments` | Assign sales staff to leads |
| `lead_sources` | Lookup: referral, website, social, etc. |
| `lead_conversions` | Record of lead-to-client conversion events |

---

### Documents

| Table | Purpose |
|---|---|
| `document_folders` | Hierarchical folder structure |
| `document_categories` | Document type taxonomy |
| `documents` | Document metadata (not the file content) |
| `document_versions` | Version history per document |
| `document_storage` | Storage backend metadata (S3 key, size, mime, checksum) |
| `document_shares` | Share records with expiry and access control |
| `document_share_access_logs` | Who accessed a shared document and when |
| `document_approvals` | Approval workflow states per document |
| `document_approval_actions` | Individual approval/rejection actions |
| `document_retention_policies` | Per-category retention rules |
| `document_tags` | Free-form tags for documents |
| `document_tag_map` | Many-to-many: documents ↔ tags |
| `document_links` | Link documents to other resources (client, task, lead) |

---

### Tasks

| Table | Purpose |
|---|---|
| `task_templates` | Reusable task blueprints |
| `task_template_checklists` | Checklist items within templates |
| `tasks` | Task records |
| `task_checklists` | Checklist items on tasks |
| `task_comments` | Comments and discussion on tasks |
| `task_attachments` | Files attached to tasks |
| `task_assignments` | Users assigned to tasks |
| `task_status_history` | Audit trail of status transitions |
| `task_time_logs` | Time tracking per task per user |
| `task_links` | Link tasks to clients, documents, leads |
| `task_dependencies` | Task-to-task dependency graph |

---

### Notifications

| Table | Purpose |
|---|---|
| `notification_channels` | Lookup: IN_APP, EMAIL, SMS, PUSH, WEBHOOK |
| `notification_templates` | Message templates per event type and channel |
| `notification_template_variables` | Variable definitions for templates |
| `notifications` | Individual notification records |
| `notification_deliveries` | Per-channel delivery attempts and status |
| `notification_preferences` | User preferences per event type per channel |
| `notification_subscriptions` | User subscriptions to specific resource events |

---

### Billing & Subscriptions

| Table | Purpose |
|---|---|
| `billing_plans` | SaaS plan definitions (Starter, Professional, Enterprise) |
| `plan_features` | Feature flags and limits per plan |
| `plan_feature_map` | Many-to-many: plans ↔ features with limits |
| `subscriptions` | Active subscription per tenant |
| `subscription_history` | Plan upgrade/downgrade history |
| `trials` | Trial period tracking |
| `invoices` | Monthly/annual invoice records |
| `invoice_line_items` | Line items within an invoice |
| `payments` | Payment transaction records |
| `payment_gateway_events` | Raw webhook events from payment gateways |
| `usage_records` | Metered usage tracking (users, storage, API calls) |
| `coupon_codes` | Discount coupons |
| `coupon_redemptions` | Track coupon usage per tenant |

---

### Reports

| Table | Purpose |
|---|---|
| `report_definitions` | Report configuration and query definitions |
| `report_runs` | Report execution instances |
| `report_results` | Stored report output (link to file or JSON) |
| `saved_filters` | User-saved filter presets |
| `report_schedules` | Cron-based report scheduling |

---

### Audit

| Table | Purpose |
|---|---|
| `audit_logs` | All create/update/delete operations |
| `login_history` | Authentication event log |
| `permission_change_logs` | Role and permission change audit |
| `data_export_logs` | Track GDPR data export requests |

---

### Dashboard

| Table | Purpose |
|---|---|
| `dashboard_layouts` | Per-user dashboard grid layouts |
| `dashboard_widgets` | Widget definitions and configs |
| `user_widget_preferences` | Per-user widget customization |
| `saved_dashboard_filters` | Saved filter sets for dashboards |

---

### Settings

| Table | Purpose |
|---|---|
| `firm_settings` | Tenant-wide settings (one row per tenant) |
| `user_settings` | Per-user settings overrides |
| `notification_settings` | Per-user notification channel preferences |
| `integration_settings` | Third-party integration configs per tenant |
| `custom_field_definitions` | Custom fields defined by tenant admin |
| `custom_field_values` | Custom field values per entity |

---

### White Label

| Table | Purpose |
|---|---|
| `tenant_branding` | Logo, colors, fonts, CSS overrides per tenant |
| `custom_domains` | Custom domain mapping and SSL status |
| `smtp_configs` | Custom SMTP configuration per tenant |
| `payment_gateway_configs` | Payment gateway keys per tenant |

---

## Part 4 — Relationship Design

### 4.1 tenants

| Relationship | Target | Type | Notes |
|---|---|---|---|
| One tenant | many `users` | 1:M | `users.tenant_id → tenants.id` |
| One tenant | many `roles` | 1:M | `roles.tenant_id → tenants.id` |
| One tenant | one `subscription` | 1:1 | `subscriptions.tenant_id UNIQUE` |
| One tenant | one `firm_settings` | 1:1 | `firm_settings.tenant_id UNIQUE` |
| One tenant | one `tenant_branding` | 1:1 | `tenant_branding.tenant_id UNIQUE` |
| One tenant | one `custom_domain` | 1:1 | `custom_domains.tenant_id UNIQUE` |
| One tenant | many `clients` | 1:M | cascade soft-delete |
| One tenant | many `businesses` | 1:M | cascade soft-delete |
| **Cascade on DELETE** | — | Restrict | Never hard-delete a tenant. Suspend instead. |

---

### 4.2 users

| Relationship | Target | Type | Notes |
|---|---|---|---|
| One user | one `user_profile` | 1:1 | `user_profiles.user_id UNIQUE` |
| One user | many `user_roles` | 1:M | through junction table |
| One user | many `user_sessions` | 1:M | cascade delete on user delete |
| One user | many `refresh_tokens` | 1:M | cascade delete |
| One user | many `task_assignments` | 1:M | |
| One user | many `notifications` | 1:M | |
| One user | many `audit_logs` | 1:M | |
| **Delete Rule** | — | Soft delete | `users.deleted_at`, never hard delete |

---

### 4.3 roles ↔ permissions

| Relationship | Target | Type | Notes |
|---|---|---|---|
| Role | many `permissions` | M:M | via `role_permissions` |
| User | many `roles` | M:M | via `user_roles` (tenant-scoped) |
| Permission | many `permission_groups` | M:M | via `permission_group_map` |
| **Cascade** | — | Cascade delete | Delete `role_permissions` when role deleted |

---

### 4.4 businesses ↔ contacts

| Relationship | Target | Type | Notes |
|---|---|---|---|
| Business | many `contacts` | M:M | via `contact_business_roles` |
| Business | many `addresses` | 1:M | `business_addresses` |
| Business | many `documents` | M:M | via `document_links` (polymorphic) |
| Business | many `users` (staff) | M:M | via `business_assignments` |
| Contact | many `businesses` | M:M | via `contact_business_roles` |
| **Delete Rule** | — | Soft delete | Restrict hard delete if active client |

---

### 4.5 clients

| Relationship | Target | Type | Notes |
|---|---|---|---|
| Client | one `business` OR one `contact` | 1:1 (polymorphic) | `entity_type + entity_id` |
| Client | many `client_assignments` | 1:M | |
| Client | many `tasks` | 1:M | via `task_links` |
| Client | many `documents` | M:M | via `document_links` |
| Client | many `client_groups` | M:M | via `client_group_members` |
| **Delete Rule** | — | Soft delete only | Historical data must be retained |

---

### 4.6 documents

| Relationship | Target | Type | Notes |
|---|---|---|---|
| Document | many `document_versions` | 1:M | one marked as `is_current` |
| Document | one `document_storage` | 1:1 | per version |
| Document | one `document_folder` | M:1 | nullable (root-level docs) |
| Document | many `document_shares` | 1:M | |
| Document | many `document_approvals` | 1:M | |
| Document | many `document_tags` | M:M | via `document_tag_map` |
| Document | any resource | M:M | via `document_links` (polymorphic ref) |
| **Cascade** | — | Cascade soft delete | Soft-delete versions when document deleted |

---

### 4.7 tasks

| Relationship | Target | Type | Notes |
|---|---|---|---|
| Task | one parent `task` (nullable) | Self 1:M | subtasks |
| Task | many `task_assignments` | 1:M | |
| Task | many `task_comments` | 1:M | cascade delete |
| Task | many `task_attachments` | 1:M | cascade delete |
| Task | many `task_checklists` | 1:M | cascade delete |
| Task | many `task_time_logs` | 1:M | |
| Task | many tasks (dependencies) | M:M | via `task_dependencies` |
| Task | any resource | M:M | via `task_links` (polymorphic) |
| **Delete Rule** | — | Soft delete | Reassign or archive before delete |

---

### 4.8 subscriptions ↔ invoices ↔ payments

| Relationship | Target | Type | Notes |
|---|---|---|---|
| Subscription | one `billing_plan` | M:1 | |
| Subscription | many `invoices` | 1:M | |
| Invoice | many `invoice_line_items` | 1:M | cascade delete |
| Invoice | many `payments` | 1:M | |
| Payment | one `invoice` | M:1 | |
| **Delete Rule** | Invoices | RESTRICT | Never delete invoices (legal requirement) |
| **Delete Rule** | Payments | RESTRICT | Never delete payment records |

---

## Part 5 — Tenant Isolation

### 5.1 Tenant Table

```
tenants
  id            UUID   PK
  slug          TEXT   UNIQUE    -- URL identifier (e.g., "sharma-associates")
  name          TEXT
  status        ENUM   (ACTIVE, SUSPENDED, DEACTIVATED, TRIAL)
  plan_id       UUID   FK → billing_plans.id
  created_at    TIMESTAMPTZ
  deleted_at    TIMESTAMPTZ NULL
```

### 5.2 tenantId Column Rule

| Table Category | tenant_id Required? | Notes |
|---|---|---|
| `tenants` | ❌ No | This IS the tenant table |
| `master_admins` | ❌ No | Platform-level |
| `platform_settings` | ❌ No | Singleton global row |
| `billing_plans` | ❌ No | Shared across all tenants |
| `plan_features` | ❌ No | Shared across all tenants |
| `permissions` | ❌ No | System-defined, shared |
| `notification_channels` | ❌ No | Enum-like lookup |
| All user tables | ✅ Yes | Every user belongs to a tenant |
| All business tables | ✅ Yes | Business data is tenant-owned |
| All client tables | ✅ Yes | |
| All CRM tables | ✅ Yes | |
| All document tables | ✅ Yes | |
| All task tables | ✅ Yes | |
| All notification tables | ✅ Yes | |
| All subscription tables | ✅ Yes | |
| All report tables | ✅ Yes | |
| All audit tables | ✅ Yes | (NULL for platform-level events) |
| All settings tables | ✅ Yes | |
| All white label tables | ✅ Yes | |

### 5.3 Table Classification

**Global / System Tables** (no tenant_id):
`tenants`, `master_admins`, `billing_plans`, `plan_features`, `permissions`, `permission_groups`, `notification_channels`, `business_types`, `contact_roles`, `lead_sources`, `platform_settings`, `platform_audit_logs`

**Tenant-Scoped Tables** (tenant_id NOT NULL + FK):
Every other table in the system.

**Shared Reference Tables** (read-only lookups used by all tenants):
`business_types`, `contact_roles`, `lead_sources`, `notification_channels` — seeded by platform, read by all tenants.

**Tenant-Configurable Reference Tables** (tenant_id present, tenant can extend):
`pipelines`, `pipeline_stages`, `document_categories`, `document_folders`, `roles`, `task_templates`

### 5.4 Row Level Security (RLS) Policy Pattern

```sql
-- Example RLS policy on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

Prisma always sets `app.tenant_id` at the start of each transaction via a session-level variable. This acts as a last-line-of-defense even if application code fails to include the `WHERE tenant_id = ?` clause.

---

## Part 6 — User & Permission Model (RBAC)

### 6.1 Users Table

```
users
  id                UUID        PK
  tenant_id         UUID        FK → tenants.id, NOT NULL
  email             TEXT        UNIQUE per tenant (unique constraint: tenant_id + email)
  password_hash     TEXT        NULL (NULL for OAuth-only or invited-pending users)
  first_name        TEXT
  last_name         TEXT
  phone             TEXT        NULL
  status            ENUM        (ACTIVE, INACTIVE, INVITED, SUSPENDED, DELETED)
  is_owner          BOOLEAN     DEFAULT false  -- firm owner/founding partner
  last_login_at     TIMESTAMPTZ NULL
  created_by        UUID        NULL FK → users.id
  created_at        TIMESTAMPTZ DEFAULT now()
  updated_at        TIMESTAMPTZ
  deleted_at        TIMESTAMPTZ NULL
  deleted_by        UUID        NULL FK → users.id
```

**Unique constraint:** `(tenant_id, email)` — same email can exist across different tenants.

---

### 6.2 Permissions Table (System-Defined)

```
permissions
  id            UUID    PK
  group_id      UUID    FK → permission_groups.id
  code          TEXT    UNIQUE   -- e.g., "clients:read", "documents:delete"
  name          TEXT             -- Human-readable: "View Clients"
  description   TEXT
  module        TEXT             -- "clients", "documents", "tasks", etc.
  action        ENUM    (CREATE, READ, UPDATE, DELETE, EXPORT, SHARE, APPROVE, ASSIGN)
  resource      TEXT             -- resource this permission governs
  is_sensitive  BOOLEAN DEFAULT false  -- triggers extra audit logging
  created_at    TIMESTAMPTZ
```

**Permission Code Convention:** `{module}:{action}` — e.g.:
- `clients:read` · `clients:create` · `clients:delete`
- `documents:upload` · `documents:share` · `documents:approve`
- `billing:read` · `billing:manage`
- `users:invite` · `users:deactivate`

---

### 6.3 Permission Groups Table

```
permission_groups
  id            UUID    PK
  name          TEXT    UNIQUE   -- "Client Management", "Document Management"
  description   TEXT
  module        TEXT
  display_order INTEGER
```

---

### 6.4 Roles Table (Tenant-Defined)

```
roles
  id            UUID    PK
  tenant_id     UUID    FK → tenants.id, NOT NULL
  name          TEXT             -- "Senior Manager", "Tax Associate", "Auditor"
  description   TEXT
  is_system     BOOLEAN DEFAULT false  -- system defaults, cannot be deleted
  is_active     BOOLEAN DEFAULT true
  created_by    UUID    FK → users.id
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ
  deleted_at    TIMESTAMPTZ NULL
```

**Unique constraint:** `(tenant_id, name)` — role names unique within a tenant.

**System roles (seeded, `is_system = true`):**
- `Firm Owner` — all permissions
- `Manager` — most permissions
- `Staff` — limited permissions
- `Viewer` — read-only

Tenants can create custom roles on top of system roles. System roles cannot be deleted but can be extended.

---

### 6.5 Role Permissions Junction

```
role_permissions
  id              UUID    PK
  role_id         UUID    FK → roles.id, NOT NULL
  permission_id   UUID    FK → permissions.id, NOT NULL
  granted_by      UUID    FK → users.id
  granted_at      TIMESTAMPTZ DEFAULT now()
  UNIQUE (role_id, permission_id)
```

---

### 6.6 User Roles Junction

```
user_roles
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id, NOT NULL
  user_id         UUID    FK → users.id, NOT NULL
  role_id         UUID    FK → roles.id, NOT NULL
  assigned_by     UUID    FK → users.id
  assigned_at     TIMESTAMPTZ DEFAULT now()
  expires_at      TIMESTAMPTZ NULL  -- temporary role assignments
  UNIQUE (tenant_id, user_id, role_id)
```

**Index:** `(tenant_id, user_id)` for fast permission resolution.

---

### 6.7 RBAC Resolution Flow

```
Request arrives with JWT (user_id, tenant_id)
        │
        ▼
Load user_roles WHERE user_id = ? AND tenant_id = ?
        │
        ▼
Load role_permissions WHERE role_id IN (user's role IDs)
        │
        ▼
Extract permission codes → ["clients:read", "tasks:create", ...]
        │
        ▼
Cache in Redis: key = "perms:{tenant_id}:{user_id}" TTL = 5min
        │
        ▼
Permission middleware checks required permission code against cached set
```

**Permission inheritance:** Users can have multiple roles. Effective permissions = union of all permissions across all assigned roles.

**Permission override:** Future: per-user permission overrides table for granular exceptions without role changes.

---

## Part 7 — Business Data Model

### 7.1 Business Types (System Lookup)

```
business_types
  id            UUID    PK
  code          TEXT    UNIQUE    -- "INDIVIDUAL", "PROPRIETORSHIP", "PARTNERSHIP", "LLP",
                                 --  "PRIVATE_LIMITED", "PUBLIC_LIMITED", "OPC", "LLP",
                                 --  "TRUST", "SOCIETY", "NGO", "HUF", "COOPERATIVE", "SECTION8"
  name          TEXT              -- "Hindu Undivided Family"
  description   TEXT
  requires_pan  BOOLEAN DEFAULT true
  requires_gst  BOOLEAN DEFAULT false
  is_active     BOOLEAN DEFAULT true
  display_order INTEGER
```

---

### 7.2 Businesses Table

```
businesses
  id                    UUID        PK
  tenant_id             UUID        FK → tenants.id, NOT NULL
  business_type_id      UUID        FK → business_types.id, NOT NULL
  name                  TEXT        NOT NULL
  display_name          TEXT        NULL       -- DBA / trade name
  description           TEXT        NULL
  status                ENUM        (ACTIVE, INACTIVE, DISSOLVED, STRUCK_OFF)
  incorporation_date    DATE        NULL
  dissolution_date      DATE        NULL
  financial_year_start  SMALLINT   DEFAULT 4   -- Month (April = 4 for Indian FY)
  currency              CHAR(3)    DEFAULT 'INR'
  website               TEXT        NULL
  search_vector         TSVECTOR    NULL        -- Full-text search
  created_by            UUID        FK → users.id
  created_at            TIMESTAMPTZ
  updated_at            TIMESTAMPTZ
  deleted_at            TIMESTAMPTZ NULL
  deleted_by            UUID        NULL FK → users.id
```

**Index:** GIN on `search_vector` for full-text search. `(tenant_id, status)` composite.

---

### 7.3 Business Identifiers

```
business_identifiers
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id, NOT NULL
  business_id     UUID    FK → businesses.id, NOT NULL
  type            ENUM    (PAN, TAN, GSTIN, CIN, LLPIN, ROC, TRN, UDYAM, FSSAI,
                           IEC, ESIC, PF, PT, SHOP_ACT, TRADEMARK, ISO)
  value           TEXT    NOT NULL
  state           CHAR(2) NULL     -- For GSTIN (state code)
  is_primary      BOOLEAN DEFAULT false
  valid_from      DATE    NULL
  valid_to        DATE    NULL
  verified_at     TIMESTAMPTZ NULL
  verified_by     UUID    FK → users.id
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  UNIQUE (tenant_id, type, value)  -- PAN unique within tenant
```

---

### 7.4 Business Addresses

```
business_addresses
  id                UUID    PK
  tenant_id         UUID    FK → tenants.id
  business_id       UUID    FK → businesses.id
  type              ENUM    (REGISTERED, OPERATIONAL, CORRESPONDENCE, BRANCH)
  address_line_1    TEXT
  address_line_2    TEXT    NULL
  city              TEXT
  state             TEXT
  pin_code          CHAR(6)
  country           CHAR(2) DEFAULT 'IN'
  is_primary        BOOLEAN DEFAULT false
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
```

---

### 7.5 Business Assignments

```
business_assignments
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  business_id     UUID    FK → businesses.id
  user_id         UUID    FK → users.id
  role            TEXT    NULL  -- "Relationship Manager", "Tax Lead", etc.
  is_primary      BOOLEAN DEFAULT false
  assigned_by     UUID    FK → users.id
  assigned_at     TIMESTAMPTZ
  unassigned_at   TIMESTAMPTZ NULL
  UNIQUE (tenant_id, business_id, user_id)
```

---

### 7.6 Business Compliance Status

```
business_compliance_status
  id                UUID    PK
  tenant_id         UUID    FK → tenants.id
  business_id       UUID    FK → businesses.id
  compliance_type   ENUM    (GST_RETURN, ITR, TDS, AUDIT, ROC_FILING, ANNUAL_RETURN, MCA_FILING)
  period            TEXT           -- "FY2024-25", "Q1-2025", "Oct-2024"
  due_date          DATE
  status            ENUM    (PENDING, IN_PROGRESS, FILED, DELAYED, EXEMPT)
  filed_date        DATE    NULL
  filed_by          UUID    FK → users.id NULL
  notes             TEXT    NULL
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
```

---

## Part 8 — Document Management Model

### 8.1 Document Folders (Hierarchical)

```
document_folders
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  parent_id       UUID    NULL FK → document_folders.id  -- Self-referential tree
  name            TEXT
  path            TEXT    -- Materialized path: "/root/clients/sharma-ltd/"
  description     TEXT    NULL
  is_system       BOOLEAN DEFAULT false  -- System-created, cannot be deleted
  client_id       UUID    NULL FK → clients.id  -- Auto-folder per client
  business_id     UUID    NULL FK → businesses.id
  created_by      UUID    FK → users.id
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  deleted_at      TIMESTAMPTZ NULL
```

**Pattern:** Materialized path (`path` column) for efficient subtree queries without recursive CTEs on every request.

---

### 8.2 Document Categories

```
document_categories
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  name            TEXT             -- "Income Tax Returns", "GST Filings", "Audit Reports"
  code            TEXT             -- "ITR", "GST", "AUDIT"
  parent_id       UUID    NULL FK → document_categories.id
  retention_days  INTEGER NULL     -- Override global retention policy
  is_system       BOOLEAN DEFAULT false
  created_at      TIMESTAMPTZ
  UNIQUE (tenant_id, code)
```

---

### 8.3 Documents Table

```
documents
  id                UUID        PK
  tenant_id         UUID        FK → tenants.id
  folder_id         UUID        NULL FK → document_folders.id
  category_id       UUID        NULL FK → document_categories.id
  name              TEXT        NOT NULL
  description       TEXT        NULL
  status            ENUM        (DRAFT, ACTIVE, UNDER_REVIEW, APPROVED, ARCHIVED, DELETED)
  current_version   INTEGER     DEFAULT 1
  total_versions    INTEGER     DEFAULT 1
  is_confidential   BOOLEAN     DEFAULT false
  requires_approval BOOLEAN     DEFAULT false
  approval_status   ENUM        (NOT_REQUIRED, PENDING, APPROVED, REJECTED) DEFAULT 'NOT_REQUIRED'
  locked_by         UUID        NULL FK → users.id
  locked_at         TIMESTAMPTZ NULL
  search_vector     TSVECTOR    NULL
  created_by        UUID        FK → users.id
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
  deleted_at        TIMESTAMPTZ NULL
  deleted_by        UUID        NULL FK → users.id
```

---

### 8.4 Document Versions

```
document_versions
  id              UUID        PK
  tenant_id       UUID        FK → tenants.id
  document_id     UUID        FK → documents.id
  version_number  INTEGER     NOT NULL
  change_summary  TEXT        NULL
  is_current      BOOLEAN     DEFAULT false
  storage_id      UUID        FK → document_storage.id
  uploaded_by     UUID        FK → users.id
  uploaded_at     TIMESTAMPTZ DEFAULT now()
  UNIQUE (document_id, version_number)
```

---

### 8.5 Document Storage (S3 Metadata)

```
document_storage
  id              UUID        PK
  tenant_id       UUID        FK → tenants.id
  version_id      UUID        FK → document_versions.id
  storage_key     TEXT        UNIQUE  -- S3/R2 object key
  storage_bucket  TEXT
  storage_region  TEXT
  file_name       TEXT                -- Original filename
  file_size       BIGINT              -- bytes
  mime_type       TEXT
  checksum_sha256 CHAR(64)            -- SHA-256 for integrity verification
  encryption_key_id TEXT NULL         -- KMS key reference
  is_encrypted    BOOLEAN DEFAULT true
  uploaded_at     TIMESTAMPTZ
```

---

### 8.6 Document Shares

```
document_shares
  id              UUID        PK
  tenant_id       UUID        FK → tenants.id
  document_id     UUID        FK → documents.id
  share_type      ENUM        (INTERNAL_USER, EXTERNAL_EMAIL, PUBLIC_LINK)
  shared_with     UUID        NULL FK → users.id   -- For INTERNAL_USER
  external_email  TEXT        NULL                  -- For EXTERNAL_EMAIL
  share_token     TEXT        UNIQUE NULL           -- For PUBLIC_LINK
  access_level    ENUM        (VIEW, DOWNLOAD, COMMENT, EDIT)
  expires_at      TIMESTAMPTZ NULL
  max_downloads   INTEGER     NULL
  download_count  INTEGER     DEFAULT 0
  password_hash   TEXT        NULL                  -- Optional password protection
  shared_by       UUID        FK → users.id
  created_at      TIMESTAMPTZ
  revoked_at      TIMESTAMPTZ NULL
```

---

### 8.7 Document Approvals

```
document_approvals
  id              UUID        PK
  tenant_id       UUID        FK → tenants.id
  document_id     UUID        FK → documents.id
  version_id      UUID        FK → document_versions.id
  sequence        INTEGER     NOT NULL               -- Order of approvers
  approver_id     UUID        FK → users.id
  status          ENUM        (PENDING, APPROVED, REJECTED, SKIPPED)
  comments        TEXT        NULL
  acted_at        TIMESTAMPTZ NULL
  due_date        TIMESTAMPTZ NULL
  created_at      TIMESTAMPTZ
```

---

### 8.8 Document Retention Policies

```
document_retention_policies
  id                UUID        PK
  tenant_id         UUID        FK → tenants.id
  category_id       UUID        NULL FK → document_categories.id
  name              TEXT
  retention_years   INTEGER     NOT NULL  -- 7 years for most CA docs (ICAI mandate)
  after_expiry      ENUM        (ARCHIVE, DELETE, NOTIFY_AND_HOLD)
  is_default        BOOLEAN     DEFAULT false
  legal_reference   TEXT        NULL      -- "Section 128 Companies Act 2013"
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
```

---

## Part 9 — CRM Data Model

### 9.1 Pipelines

```
pipelines
  id            UUID    PK
  tenant_id     UUID    FK → tenants.id
  name          TEXT                -- "New Client Acquisition"
  description   TEXT    NULL
  is_default    BOOLEAN DEFAULT false
  is_active     BOOLEAN DEFAULT true
  created_by    UUID    FK → users.id
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ
```

---

### 9.2 Pipeline Stages

```
pipeline_stages
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  pipeline_id     UUID    FK → pipelines.id
  name            TEXT                    -- "Initial Contact", "Proposal Sent", "Won", "Lost"
  stage_type      ENUM    (OPEN, WON, LOST)
  display_order   INTEGER
  probability     SMALLINT NULL          -- Win probability % (0-100)
  color           CHAR(7)  NULL          -- Hex color for Kanban
  is_active       BOOLEAN  DEFAULT true
  created_at      TIMESTAMPTZ
```

---

### 9.3 Leads

```
leads
  id                UUID        PK
  tenant_id         UUID        FK → tenants.id
  pipeline_id       UUID        FK → pipelines.id
  stage_id          UUID        FK → pipeline_stages.id
  source_id         UUID        NULL FK → lead_sources.id
  title             TEXT        NOT NULL    -- "Sharma & Sons - GST Filing"
  company_name      TEXT        NULL
  contact_name      TEXT        NULL
  email             TEXT        NULL
  phone             TEXT        NULL
  estimated_value   DECIMAL(15,2) NULL
  currency          CHAR(3)     DEFAULT 'INR'
  expected_close    DATE        NULL
  priority          ENUM        (LOW, MEDIUM, HIGH, URGENT)
  status            ENUM        (OPEN, WON, LOST, STALLED)
  lost_reason       TEXT        NULL
  notes             TEXT        NULL
  converted_at      TIMESTAMPTZ NULL
  converted_to      UUID        NULL FK → clients.id
  assigned_to       UUID        NULL FK → users.id
  created_by        UUID        FK → users.id
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
  deleted_at        TIMESTAMPTZ NULL
```

---

### 9.4 Lead Activities

```
lead_activities
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  lead_id         UUID    FK → leads.id
  type            ENUM    (CALL, EMAIL, MEETING, DEMO, FOLLOW_UP, WHATSAPP, NOTE, TASK)
  subject         TEXT
  description     TEXT    NULL
  outcome         TEXT    NULL
  scheduled_at    TIMESTAMPTZ NULL
  completed_at    TIMESTAMPTZ NULL
  duration_mins   INTEGER NULL
  created_by      UUID    FK → users.id
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

---

### 9.5 Lead Stage History

```
lead_stage_history
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  lead_id         UUID    FK → leads.id
  from_stage_id   UUID    NULL FK → pipeline_stages.id
  to_stage_id     UUID    FK → pipeline_stages.id
  changed_by      UUID    FK → users.id
  changed_at      TIMESTAMPTZ DEFAULT now()
  notes           TEXT    NULL
  time_in_stage_hours INTEGER NULL  -- Computed duration in previous stage
```

---

## Part 10 — Task System

### 10.1 Task Templates

```
task_templates
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  name            TEXT
  description     TEXT    NULL
  default_priority ENUM   (LOW, MEDIUM, HIGH, URGENT)
  estimated_hours DECIMAL(6,2) NULL
  tags            TEXT[]  NULL
  is_active       BOOLEAN DEFAULT true
  created_by      UUID    FK → users.id
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

---

### 10.2 Tasks

```
tasks
  id                UUID        PK
  tenant_id         UUID        FK → tenants.id
  parent_id         UUID        NULL FK → tasks.id    -- Subtask parent
  template_id       UUID        NULL FK → task_templates.id
  title             TEXT        NOT NULL
  description       TEXT        NULL
  status            ENUM        (TODO, IN_PROGRESS, IN_REVIEW, BLOCKED, DONE, CANCELLED)
  priority          ENUM        (LOW, MEDIUM, HIGH, URGENT)
  type              ENUM        (GENERAL, CLIENT_WORK, COMPLIANCE, INTERNAL, FOLLOW_UP)
  due_date          TIMESTAMPTZ NULL
  start_date        TIMESTAMPTZ NULL
  completed_at      TIMESTAMPTZ NULL
  estimated_hours   DECIMAL(6,2) NULL
  actual_hours      DECIMAL(6,2) NULL    -- Sum of time logs
  progress          SMALLINT    DEFAULT 0  -- 0-100 percent
  tags              TEXT[]      NULL
  is_recurring      BOOLEAN     DEFAULT false
  recurrence_rule   TEXT        NULL        -- iCal RRULE string
  next_occurrence   TIMESTAMPTZ NULL
  created_by        UUID        FK → users.id
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
  deleted_at        TIMESTAMPTZ NULL
```

---

### 10.3 Task Assignments

```
task_assignments
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  task_id         UUID    FK → tasks.id
  user_id         UUID    FK → users.id
  role            ENUM    (ASSIGNEE, REVIEWER, WATCHER, CO_ASSIGNEE)
  assigned_by     UUID    FK → users.id
  assigned_at     TIMESTAMPTZ DEFAULT now()
  UNIQUE (task_id, user_id, role)
```

---

### 10.4 Task Comments

```
task_comments
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  task_id         UUID    FK → tasks.id
  parent_id       UUID    NULL FK → task_comments.id  -- Threaded comments
  content         TEXT    NOT NULL
  is_edited       BOOLEAN DEFAULT false
  edited_at       TIMESTAMPTZ NULL
  created_by      UUID    FK → users.id
  created_at      TIMESTAMPTZ
  deleted_at      TIMESTAMPTZ NULL
```

---

### 10.5 Task Time Logs

```
task_time_logs
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  task_id         UUID    FK → tasks.id
  user_id         UUID    FK → users.id
  started_at      TIMESTAMPTZ NOT NULL
  ended_at        TIMESTAMPTZ NULL
  duration_mins   INTEGER NULL          -- Computed or manual entry
  description     TEXT    NULL
  is_billable     BOOLEAN DEFAULT true
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

---

### 10.6 Task Links (Polymorphic)

```
task_links
  id                UUID    PK
  tenant_id         UUID    FK → tenants.id
  task_id           UUID    FK → tasks.id
  linked_type       ENUM    (CLIENT, BUSINESS, DOCUMENT, LEAD, CONTACT)
  linked_id         UUID    NOT NULL       -- ID in the linked table
  created_by        UUID    FK → users.id
  created_at        TIMESTAMPTZ
  UNIQUE (task_id, linked_type, linked_id)
```

---

### 10.7 Task Dependencies

```
task_dependencies
  id                UUID    PK
  tenant_id         UUID    FK → tenants.id
  task_id           UUID    FK → tasks.id        -- Dependent task
  depends_on_id     UUID    FK → tasks.id        -- Prerequisite task
  dependency_type   ENUM    (FINISH_TO_START, START_TO_START, FINISH_TO_FINISH)
  created_by        UUID    FK → users.id
  created_at        TIMESTAMPTZ
  UNIQUE (task_id, depends_on_id)
```

---

## Part 11 — Notification Model

### 11.1 Notification Templates

```
notification_templates
  id              UUID    PK
  tenant_id       UUID    NULL FK → tenants.id  -- NULL = system default template
  event_type      TEXT    NOT NULL  -- "task.assigned", "document.approved", "invoice.due"
  channel         ENUM    (IN_APP, EMAIL, SMS, PUSH, WEBHOOK)
  subject         TEXT    NULL       -- For EMAIL channel
  body_template   TEXT    NOT NULL   -- Handlebars/Mustache template string
  variables       JSONB   NULL       -- Variable schema definition
  is_active       BOOLEAN DEFAULT true
  is_system       BOOLEAN DEFAULT false
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  UNIQUE (tenant_id, event_type, channel)
```

---

### 11.2 Notifications

```
notifications
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  user_id         UUID    FK → users.id       -- Recipient
  template_id     UUID    NULL FK → notification_templates.id
  event_type      TEXT    NOT NULL
  title           TEXT
  body            TEXT
  data            JSONB   NULL                -- Contextual data (task_id, client_name, etc.)
  is_read         BOOLEAN DEFAULT false
  read_at         TIMESTAMPTZ NULL
  resource_type   TEXT    NULL                -- "task", "document", "invoice"
  resource_id     UUID    NULL                -- ID of referenced resource
  created_at      TIMESTAMPTZ DEFAULT now()
  expires_at      TIMESTAMPTZ NULL
```

**Index:** `(tenant_id, user_id, is_read)` · `(tenant_id, user_id, created_at DESC)`

---

### 11.3 Notification Deliveries

```
notification_deliveries
  id                UUID    PK
  tenant_id         UUID    FK → tenants.id
  notification_id   UUID    FK → notifications.id
  channel           ENUM    (IN_APP, EMAIL, SMS, PUSH, WEBHOOK)
  status            ENUM    (PENDING, SENT, DELIVERED, FAILED, BOUNCED)
  provider          TEXT    NULL    -- "sendgrid", "twilio", "firebase"
  provider_message_id TEXT  NULL    -- External delivery ID
  attempt_count     SMALLINT DEFAULT 0
  last_attempt_at   TIMESTAMPTZ NULL
  delivered_at      TIMESTAMPTZ NULL
  failed_reason     TEXT    NULL
  next_retry_at     TIMESTAMPTZ NULL
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
```

---

### 11.4 Notification Preferences

```
notification_preferences
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  user_id         UUID    FK → users.id
  event_type      TEXT    NOT NULL
  channel         ENUM    (IN_APP, EMAIL, SMS, PUSH)
  is_enabled      BOOLEAN DEFAULT true
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  UNIQUE (tenant_id, user_id, event_type, channel)
```

---

## Part 12 — Billing Model

### 12.1 Billing Plans (Global)

```
billing_plans
  id                UUID        PK
  name              TEXT        UNIQUE        -- "Starter", "Professional", "Enterprise"
  code              TEXT        UNIQUE        -- "STARTER", "PRO", "ENTERPRISE"
  description       TEXT
  price_monthly     DECIMAL(10,2)
  price_annually    DECIMAL(10,2)
  currency          CHAR(3)     DEFAULT 'INR'
  max_users         INTEGER     NULL           -- NULL = unlimited
  max_clients       INTEGER     NULL
  max_storage_gb    INTEGER     NULL
  is_active         BOOLEAN     DEFAULT true
  is_public         BOOLEAN     DEFAULT true   -- FALSE = enterprise/custom
  sort_order        INTEGER
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
```

---

### 12.2 Plan Features

```
plan_features
  id              UUID    PK
  code            TEXT    UNIQUE        -- "CRM_MODULE", "WHITE_LABEL", "API_ACCESS"
  name            TEXT
  description     TEXT
  category        TEXT                  -- "modules", "limits", "integrations"
  feature_type    ENUM    (BOOLEAN, LIMIT, TEXT)
  created_at      TIMESTAMPTZ

plan_feature_map
  id              UUID    PK
  plan_id         UUID    FK → billing_plans.id
  feature_id      UUID    FK → plan_features.id
  is_enabled      BOOLEAN DEFAULT true
  limit_value     TEXT    NULL          -- "100" or "unlimited" or "true"
  UNIQUE (plan_id, feature_id)
```

---

### 12.3 Subscriptions

```
subscriptions
  id                  UUID        PK
  tenant_id           UUID        FK → tenants.id UNIQUE   -- One per tenant
  plan_id             UUID        FK → billing_plans.id
  status              ENUM        (TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED, EXPIRED)
  billing_cycle       ENUM        (MONTHLY, ANNUALLY)
  current_period_start DATE
  current_period_end   DATE
  trial_start         DATE        NULL
  trial_end           DATE        NULL
  cancelled_at        TIMESTAMPTZ NULL
  cancel_reason       TEXT        NULL
  gateway_subscription_id TEXT   NULL    -- Razorpay/Stripe subscription ID
  created_at          TIMESTAMPTZ
  updated_at          TIMESTAMPTZ
```

---

### 12.4 Invoices

```
invoices
  id              UUID        PK
  tenant_id       UUID        FK → tenants.id
  subscription_id UUID        FK → subscriptions.id
  invoice_number  TEXT        UNIQUE              -- "INV-2025-001234"
  status          ENUM        (DRAFT, SENT, PAID, PARTIALLY_PAID, OVERDUE, VOID, UNCOLLECTIBLE)
  amount          DECIMAL(15,2)
  tax_amount      DECIMAL(15,2) DEFAULT 0
  discount_amount DECIMAL(15,2) DEFAULT 0
  total_amount    DECIMAL(15,2)
  currency        CHAR(3)     DEFAULT 'INR'
  due_date        DATE
  paid_at         TIMESTAMPTZ NULL
  void_at         TIMESTAMPTZ NULL
  notes           TEXT        NULL
  pdf_storage_key TEXT        NULL                -- S3 key for invoice PDF
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

**Rule:** Invoices are IMMUTABLE once issued. Corrections create credit notes (new invoice with negative amounts).

---

### 12.5 Invoice Line Items

```
invoice_line_items
  id              UUID        PK
  invoice_id      UUID        FK → invoices.id
  description     TEXT
  quantity        DECIMAL(10,3) DEFAULT 1
  unit_price      DECIMAL(15,2)
  amount          DECIMAL(15,2)
  tax_rate        DECIMAL(5,2) DEFAULT 0
  tax_amount      DECIMAL(15,2) DEFAULT 0
  sort_order      INTEGER
```

---

### 12.6 Payments

```
payments
  id                  UUID        PK
  tenant_id           UUID        FK → tenants.id
  invoice_id          UUID        FK → invoices.id
  amount              DECIMAL(15,2)
  currency            CHAR(3)     DEFAULT 'INR'
  status              ENUM        (PENDING, SUCCESS, FAILED, REFUNDED, PARTIALLY_REFUNDED)
  method              ENUM        (CARD, UPI, NETBANKING, WALLET, BANK_TRANSFER, CHEQUE, CASH)
  gateway             TEXT        NULL    -- "razorpay", "stripe", "manual"
  gateway_payment_id  TEXT        NULL    -- External payment ID
  gateway_order_id    TEXT        NULL
  refunded_amount     DECIMAL(15,2) DEFAULT 0
  processed_at        TIMESTAMPTZ NULL
  failure_reason      TEXT        NULL
  metadata            JSONB       NULL    -- Raw gateway response
  created_at          TIMESTAMPTZ
  updated_at          TIMESTAMPTZ
```

---

### 12.7 Usage Records

```
usage_records
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  metric          ENUM    (USERS, CLIENTS, STORAGE_GB, API_CALLS, DOCUMENTS)
  period          TEXT    NOT NULL    -- "2025-07" (YYYY-MM)
  value           DECIMAL(15,3)
  limit_value     DECIMAL(15,3) NULL  -- Plan limit at time of recording
  recorded_at     TIMESTAMPTZ
  UNIQUE (tenant_id, metric, period)
```

---

## Part 13 — Audit Model

### 13.1 Audit Logs

```
audit_logs
  id              UUID        PK
  tenant_id       UUID        NULL FK → tenants.id  -- NULL for platform-level
  user_id         UUID        NULL FK → users.id
  action          ENUM        (CREATE, READ, UPDATE, DELETE, RESTORE, EXPORT, LOGIN,
                               LOGOUT, PERMISSION_CHANGE, SETTINGS_CHANGE)
  resource_type   TEXT        NOT NULL    -- "client", "document", "user", "role"
  resource_id     UUID        NULL
  resource_label  TEXT        NULL        -- Human-readable resource name at time of action
  old_data        JSONB       NULL        -- Previous state (for UPDATE/DELETE)
  new_data        JSONB       NULL        -- New state (for CREATE/UPDATE)
  diff            JSONB       NULL        -- Computed diff (optional, for efficiency)
  ip_address      INET        NULL
  user_agent      TEXT        NULL
  correlation_id  UUID        NULL        -- Request trace ID
  metadata        JSONB       NULL        -- Extra context
  created_at      TIMESTAMPTZ DEFAULT now()
```

**Partitioning:** Monthly RANGE partitioning on `created_at`. Partition naming: `audit_logs_2025_07`.

**Index:** `(tenant_id, created_at DESC)` · `(tenant_id, resource_type, resource_id)` · `(tenant_id, user_id, created_at DESC)`

**Immutability:** No UPDATE or DELETE on this table ever. Enforced at DB level via a trigger that raises an exception on UPDATE/DELETE.

---

### 13.2 Login History

```
login_history
  id              UUID        PK
  tenant_id       UUID        NULL FK → tenants.id
  user_id         UUID        NULL FK → users.id
  email           TEXT        NOT NULL    -- Stored separately (user may be deleted)
  event_type      ENUM        (LOGIN, LOGOUT, FAILED_LOGIN, TOKEN_REFRESH, PASSWORD_RESET,
                               MFA_SUCCESS, MFA_FAILED, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED)
  status          ENUM        (SUCCESS, FAILURE)
  ip_address      INET        NULL
  user_agent      TEXT        NULL
  country         CHAR(2)     NULL        -- Geo-resolved
  city            TEXT        NULL
  session_id      UUID        NULL FK → user_sessions.id
  failure_reason  TEXT        NULL
  created_at      TIMESTAMPTZ DEFAULT now()
```

**Retention:** 2 years. Partitioned monthly.

---

### 13.3 Permission Change Logs

```
permission_change_logs
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  changed_by      UUID    FK → users.id
  target_user_id  UUID    NULL FK → users.id   -- If user role changed
  target_role_id  UUID    NULL FK → roles.id   -- If role permissions changed
  change_type     ENUM    (ROLE_ASSIGNED, ROLE_REVOKED, PERMISSION_ADDED, PERMISSION_REMOVED)
  permission_code TEXT    NULL
  role_name       TEXT    NULL
  created_at      TIMESTAMPTZ DEFAULT now()
```

---

## Part 14 — Dashboard Model

### 14.1 Dashboard Layouts

```
dashboard_layouts
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  user_id         UUID    FK → users.id
  name            TEXT    DEFAULT 'Default'
  is_default      BOOLEAN DEFAULT false
  grid_config     JSONB               -- Grid breakpoints and column config
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  UNIQUE (tenant_id, user_id, name)
```

---

### 14.2 Dashboard Widgets

```
dashboard_widgets
  id              UUID    PK
  code            TEXT    UNIQUE       -- "TASK_SUMMARY", "CLIENT_COUNT", "RECENT_DOCS"
  name            TEXT
  description     TEXT    NULL
  category        TEXT                 -- "tasks", "clients", "billing", "crm"
  data_source     TEXT                 -- Internal query key
  default_config  JSONB   NULL         -- Default chart type, time range, etc.
  required_permission TEXT NULL        -- Permission code needed to view
  is_active       BOOLEAN DEFAULT true
  created_at      TIMESTAMPTZ
```

---

### 14.3 User Widget Preferences

```
user_widget_preferences
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  layout_id       UUID    FK → dashboard_layouts.id
  widget_id       UUID    FK → dashboard_widgets.id
  position_x      SMALLINT
  position_y      SMALLINT
  width           SMALLINT
  height          SMALLINT
  config          JSONB   NULL         -- User-specific widget config
  is_visible      BOOLEAN DEFAULT true
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

---

### 14.4 Saved Dashboard Filters

```
saved_dashboard_filters
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  user_id         UUID    FK → users.id
  name            TEXT
  page            TEXT                 -- "tasks", "clients", "documents"
  filters         JSONB   NOT NULL     -- Filter state object
  is_default      BOOLEAN DEFAULT false
  is_shared       BOOLEAN DEFAULT false  -- Shared with all tenant users
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

---

## Part 15 — White Label Model

### 15.1 Tenant Branding

```
tenant_branding
  id                    UUID    PK
  tenant_id             UUID    FK → tenants.id UNIQUE
  firm_name             TEXT    NULL             -- Override tenant name
  logo_storage_key      TEXT    NULL             -- S3 key for logo
  logo_dark_storage_key TEXT    NULL             -- Dark mode logo
  favicon_storage_key   TEXT    NULL
  primary_color         CHAR(7) NULL DEFAULT '#1a73e8'
  secondary_color       CHAR(7) NULL
  accent_color          CHAR(7) NULL
  background_color      CHAR(7) NULL
  font_family           TEXT    NULL DEFAULT 'Inter'
  custom_css            TEXT    NULL             -- Advanced CSS overrides
  login_page_bg         TEXT    NULL             -- S3 key for login background
  email_header_color    CHAR(7) NULL
  email_footer_text     TEXT    NULL
  footer_text           TEXT    NULL
  support_email         TEXT    NULL
  support_phone         TEXT    NULL
  created_at            TIMESTAMPTZ
  updated_at            TIMESTAMPTZ
```

---

### 15.2 Custom Domains

```
custom_domains
  id                UUID    PK
  tenant_id         UUID    FK → tenants.id UNIQUE
  domain            TEXT    UNIQUE          -- "erp.sharmaassociates.com"
  subdomain         TEXT    UNIQUE NULL     -- "sharma-associates" (auto-generated)
  verification_token TEXT                  -- TXT DNS record for domain ownership proof
  is_verified       BOOLEAN DEFAULT false
  verified_at       TIMESTAMPTZ NULL
  ssl_status        ENUM    (PENDING, PROVISIONED, FAILED, EXPIRING)
  ssl_expires_at    TIMESTAMPTZ NULL
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
```

---

### 15.3 SMTP Configurations

```
smtp_configs
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id UNIQUE
  host            TEXT
  port            SMALLINT DEFAULT 587
  username        TEXT
  password_encrypted TEXT              -- Encrypted at rest (AES-256)
  from_email      TEXT
  from_name       TEXT
  use_tls         BOOLEAN DEFAULT true
  is_verified     BOOLEAN DEFAULT false
  verified_at     TIMESTAMPTZ NULL
  last_test_at    TIMESTAMPTZ NULL
  test_status     ENUM    (SUCCESS, FAILED, PENDING) NULL
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

---

### 15.4 Payment Gateway Configurations

```
payment_gateway_configs
  id                    UUID    PK
  tenant_id             UUID    FK → tenants.id
  gateway               ENUM    (RAZORPAY, STRIPE, PAYU, CASHFREE)
  mode                  ENUM    (TEST, LIVE)
  key_id                TEXT
  key_secret_encrypted  TEXT                  -- Encrypted at rest
  webhook_secret_encrypted TEXT NULL
  is_active             BOOLEAN DEFAULT true
  created_at            TIMESTAMPTZ
  updated_at            TIMESTAMPTZ
  UNIQUE (tenant_id, gateway)
```

---

## Part 16 — Database Standards

### 16.1 Primary Keys

```
Standard: UUID v4 via gen_random_uuid()
Column name: id
Type: UUID
Constraint: PRIMARY KEY
```

No composite primary keys on business tables. All junction tables also use a surrogate UUID PK for simplicity and FK references.

---

### 16.2 Foreign Keys

```
Naming: {referenced_table_singular}_id
Example: tenant_id, user_id, client_id, document_id

Every FK must be:
  - Declared explicitly (never implicit)
  - Indexed (FK columns are always indexed)
  - Named: fk_{table}_{column}
```

---

### 16.3 Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Tables | `snake_case`, plural | `audit_logs`, `document_versions` |
| Columns | `snake_case` | `tenant_id`, `created_at`, `is_active` |
| Indexes | `idx_{table}_{columns}` | `idx_users_tenant_id_email` |
| FK constraints | `fk_{table}_{column}` | `fk_users_tenant_id` |
| Unique constraints | `uq_{table}_{columns}` | `uq_users_tenant_id_email` |
| Check constraints | `chk_{table}_{rule}` | `chk_tasks_dates_valid` |
| Enum types | `snake_case` PG enum | `task_status`, `user_role` |

---

### 16.4 Standard Timestamp Columns

Every table must have:
```
created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
```

Auto-updated via PostgreSQL trigger:
```sql
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON {table}
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
```

Tables with soft delete additionally have:
```
deleted_at  TIMESTAMPTZ  NULL
deleted_by  UUID         NULL FK → users.id
```

---

### 16.5 Soft Delete Standard

```
deleted_at  TIMESTAMPTZ NULL   -- NULL = active row
deleted_by  UUID NULL          -- Who performed the deletion

Partial index on all soft-deletable tables:
  CREATE INDEX idx_{table}_active ON {table} (tenant_id)
  WHERE deleted_at IS NULL;
```

All application queries MUST include `WHERE deleted_at IS NULL` (enforced by BaseRepository).

---

### 16.6 Enum Definitions

All finite state columns use PostgreSQL native ENUMs, not VARCHAR with check constraints. Defined at the database level, referenced in Prisma schema.

```
Pattern: {domain}_{property}
Examples:
  user_status:        ACTIVE, INACTIVE, INVITED, SUSPENDED
  task_status:        TODO, IN_PROGRESS, IN_REVIEW, BLOCKED, DONE, CANCELLED
  document_status:    DRAFT, ACTIVE, UNDER_REVIEW, APPROVED, ARCHIVED
  subscription_status: TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED, EXPIRED
  payment_status:     PENDING, SUCCESS, FAILED, REFUNDED
  notification_channel: IN_APP, EMAIL, SMS, PUSH, WEBHOOK
```

---

### 16.7 JSONB Usage Policy

JSONB is used where:
- Fields are genuinely variable (custom fields, metadata, settings)
- Schema-on-write would require frequent DDL changes
- The data needs to be queryable but not filterable as a FK

JSONB is NOT used where:
- A proper normalized column would suffice
- The field is used in JOINs
- The field requires a FK constraint

---

## Part 17 — Performance Strategy

### 17.1 Critical Composite Indexes

```sql
-- All tenant-scoped tables (mandatory)
INDEX ON table_name (tenant_id, created_at DESC)
INDEX ON table_name (tenant_id, status) WHERE deleted_at IS NULL
INDEX ON table_name (tenant_id, deleted_at) WHERE deleted_at IS NULL

-- Users
INDEX ON users (tenant_id, email)          -- Login lookup
INDEX ON users (tenant_id, status)         -- Active user count

-- Documents
INDEX ON documents (tenant_id, folder_id, deleted_at)
INDEX ON documents (tenant_id, category_id, created_at DESC)
INDEX ON document_versions (document_id, version_number)
INDEX ON document_shares (share_token) WHERE revoked_at IS NULL  -- Public link lookup

-- Tasks
INDEX ON tasks (tenant_id, status, due_date)
INDEX ON tasks (tenant_id, assigned_to, status) WHERE deleted_at IS NULL
INDEX ON task_assignments (task_id, user_id)

-- Notifications
INDEX ON notifications (tenant_id, user_id, is_read, created_at DESC)

-- Audit logs (partitioned table)
INDEX ON audit_logs (tenant_id, resource_type, resource_id)
INDEX ON audit_logs (tenant_id, user_id, created_at DESC)

-- Billing
INDEX ON invoices (tenant_id, status, due_date)
INDEX ON payments (tenant_id, invoice_id)

-- CRM
INDEX ON leads (tenant_id, stage_id, status)
INDEX ON leads (tenant_id, assigned_to, status)
```

---

### 17.2 Full-Text Search

```sql
-- documents table
ALTER TABLE documents ADD COLUMN search_vector TSVECTOR;
CREATE INDEX idx_documents_fts ON documents USING GIN (search_vector);

UPDATE trigger populates search_vector:
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))

-- businesses table (multilingual, use 'simple' config for Indian names)
ALTER TABLE businesses ADD COLUMN search_vector TSVECTOR;
CREATE INDEX idx_businesses_fts ON businesses USING GIN (search_vector);

-- contacts table
ALTER TABLE contacts ADD COLUMN search_vector TSVECTOR;

-- Trigram indexes for partial/fuzzy search (pg_trgm extension)
CREATE INDEX idx_businesses_name_trgm ON businesses
  USING GIN (name gin_trgm_ops);

CREATE INDEX idx_contacts_name_trgm ON contacts
  USING GIN (search_name gin_trgm_ops);
```

---

### 17.3 Pagination Strategy

All list endpoints use **keyset pagination** (cursor-based) for large tables, not OFFSET pagination.

```
Cursor pagination:
  WHERE (tenant_id = ? AND created_at < ?) OR (tenant_id = ? AND created_at = ? AND id < ?)
  ORDER BY created_at DESC, id DESC
  LIMIT 50

Offset pagination allowed only:
  - For small datasets (<1000 rows)
  - For report exports where cursor is impractical
```

---

### 17.4 Table Partitioning

**Range Partitioning on `created_at`:**

```
audit_logs         → Monthly partitions (high write volume)
login_history      → Monthly partitions
notification_deliveries → Monthly partitions
```

**Pattern:**
```sql
CREATE TABLE audit_logs (
  ...
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2025_07
  PARTITION OF audit_logs
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
```

`pg_partman` automates partition creation 3 months ahead.

---

### 17.5 Connection Pooling

**PgBouncer in Transaction Mode:**

```
Max DB connections:     100 (PostgreSQL setting)
PgBouncer pool size:    20 connections per database
Max client connections: 1000 (application instances × pool size)
Pool mode:              transaction
Server lifetime:        3600s
Server idle timeout:    600s
```

**Prisma connection pool:**
```
DATABASE_URL with connection_limit=10&pool_timeout=30
```

---

### 17.6 Archiving Strategy

Records older than 7 years moved to archive tables (identical schema, suffix `_archive`):
- `audit_logs_archive`
- `login_history_archive`
- `notification_deliveries_archive`

Archival job runs monthly via BullMQ scheduled job.

---

### 17.7 Redis Caching Layer

| Cache Key Pattern | TTL | Contents |
|---|---|---|
| `perms:{tenant_id}:{user_id}` | 5 min | User's effective permission set |
| `tenant:{tenant_id}` | 15 min | Tenant config + subscription status |
| `plan_features:{plan_id}` | 60 min | Plan feature limits |
| `notification:unread:{user_id}` | 30 sec | Unread notification count |
| `dashboard:{user_id}:{widget_code}` | 2 min | Widget data snapshot |

Cache invalidated on: role change, subscription change, tenant config change.

---

## Part 18 — Security Strategy

### 18.1 Encryption

**At Rest:**
- All SMTP passwords, payment gateway secrets, API keys → AES-256-GCM encrypted before storage
- Encryption key stored in AWS KMS / environment variable (never in DB)
- Document files in S3/R2 → Server-side encryption (SSE-S3 or SSE-KMS)

**In Transit:**
- TLS 1.3 mandatory for all database connections (`sslmode=require`)
- TLS for all Redis connections
- HTTPS-only application endpoints

**Column-Level Encryption (PII):**
```
contacts.aadhaar_number     → Encrypted before INSERT
users.phone                 → Encrypted before INSERT
business_identifiers.value  → Encrypted for sensitive IDs (Aadhaar)
smtp_configs.password       → Encrypted
payment_gateway_configs.key_secret → Encrypted
```

---

### 18.2 PII Data Handling

**PII Columns:**

| Table | Column | Handling |
|---|---|---|
| `users` | email, phone | Searchable encrypted (deterministic encryption) |
| `contacts` | aadhaar_number | Encrypted, masked on display (XXXX-XXXX-1234) |
| `contacts` | personal_email | Encrypted |
| `login_history` | ip_address | Retained 2 years, then anonymized |
| `audit_logs` | ip_address | Retained per policy, hashed for analytics |
| `payments` | metadata | Strip card details before storage |

**Masking:** PII fields are masked in API responses based on user permission level. Audit logs that contain PII in `old_data`/`new_data` are encrypted at the JSONB level.

---

### 18.3 GDPR-Ready Design

| GDPR Requirement | Implementation |
|---|---|
| Right to Access | `data_export_logs` table tracks export requests. Export job generates JSON of all user/contact data. |
| Right to Erasure | `deleted_at` soft-delete. Anonymization procedure: replace PII with "DELETED_USER" on hard-delete request. |
| Data Portability | Export endpoint generates GDPR-compliant JSON/CSV of all personal data. |
| Consent Tracking | `users.terms_accepted_at`, `users.privacy_accepted_at` columns. |
| Data Minimization | Only collect what's shown in entity definitions. `metadata` JSONB audited. |
| Breach Notification | `audit_logs` provide full access trail. `login_history` tracks anomalous access. |
| Retention Limits | `document_retention_policies` + archive jobs enforce retention periods. |

---

### 18.4 Row Level Security (RLS) Implementation

```sql
-- Enforce tenant isolation at DB level as last defense
CREATE POLICY tenant_isolation_policy
  ON businesses
  AS RESTRICTIVE
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Set at transaction start (via Prisma middleware)
SET LOCAL "app.current_tenant_id" = '<tenant-uuid>';
```

---

### 18.5 Audit Requirements

- **All write operations** (INSERT/UPDATE/DELETE) on business-critical tables → audit_logs row
- **Authentication events** → login_history row
- **Permission changes** → permission_change_logs row
- **Data exports** → data_export_logs row
- Audit records are **immutable** (trigger prevents UPDATE/DELETE)
- Audit records are **retained minimum 7 years** (ICAI/IT Act requirement)

---

## Part 19 — Future Expansion Strategy

### 19.1 Extension-Ready Schema Design

The schema is designed so future modules attach to existing entities without requiring structural changes to core tables.

**Extension Patterns:**

**Pattern 1: Custom Fields (already built in)**
```
custom_field_definitions
  entity_type   TEXT    -- "client", "business", "task"
  field_name    TEXT
  field_type    ENUM    (TEXT, NUMBER, DATE, BOOLEAN, DROPDOWN, MULTISELECT)
  options       JSONB   NULL

custom_field_values
  entity_type   TEXT
  entity_id     UUID
  field_id      UUID FK
  value         TEXT
```

**Pattern 2: Polymorphic Links (already built in)**
The `document_links` and `task_links` tables use `(linked_type, linked_id)` polymorphic references. New modules simply register a new `linked_type` value.

**Pattern 3: Integration Settings (already built in)**
```
integration_settings
  tenant_id       UUID
  integration_type TEXT   -- "tally", "gst_portal", "google_drive", "bank_api"
  config          JSONB   -- Integration-specific config
  credentials     JSONB   -- Encrypted credentials
  status          ENUM    (CONNECTED, DISCONNECTED, ERROR)
```

New integrations simply add a new `integration_type` value. Zero schema changes.

---

### 19.2 Future Modules — Attachment Points

| Future Module | Attaches To | How |
|---|---|---|
| **OCR Engine** | `document_versions` | Add `ocr_status`, `ocr_text`, `ocr_processed_at` columns. OCR results stored in `document_storage_metadata` JSONB. |
| **Tally Integration** | `businesses`, `clients` | `integration_settings` table with `integration_type = 'TALLY'`. New `tally_sync_logs` table. |
| **GST API** | `business_identifiers`, `business_compliance_status` | `integration_settings` for GSTIN credentials. New `gst_filings` and `gst_return_data` tables. |
| **Bank Statements** | `clients`, `businesses` | New `bank_accounts` and `bank_transactions` tables with `business_id` FK. |
| **Google Drive Sync** | `documents`, `document_folders` | `integration_settings` for OAuth tokens. New `drive_sync_map` table linking `document_id` ↔ Drive file ID. |
| **Mobile App (Push)** | `users` | New `user_devices` table: `(user_id, device_token, platform, is_active)`. Notification delivery already supports PUSH channel. |
| **Public API (v2)** | All modules | New `api_keys` table: `(tenant_id, key_hash, scopes[], rate_limit)`. `api_request_logs` for tracking. |
| **AI Assistant** | All modules | New `ai_conversations` and `ai_messages` tables. AI operates on existing data via read-only service layer. New `ai_embeddings` table for vector search (pgvector extension). |
| **Workflow Automation** | `tasks`, `clients`, `documents` | New `workflow_definitions`, `workflow_triggers`, `workflow_actions`, `workflow_runs` tables. Triggers off existing entity state changes. |
| **Time Billing** | `task_time_logs`, `clients` | New `billing_rates` table `(user_id, client_id, hourly_rate)`. `task_time_logs.is_billable` already exists. |
| **Client Portal** | `clients`, `documents`, `tasks` | New `client_portal_users` and `client_portal_sessions` tables. External-facing views of existing document and task data. |

---

### 19.3 pgvector for AI (Future)

```
-- When AI module is added:
CREATE EXTENSION vector;

document_embeddings
  id              UUID    PK
  document_id     UUID    FK → documents.id
  version_id      UUID    FK → document_versions.id
  chunk_index     INTEGER
  embedding       vector(1536)   -- OpenAI Ada-002 / Gemini embedding
  chunk_text      TEXT
  created_at      TIMESTAMPTZ

CREATE INDEX idx_doc_embeddings_hnsw
  ON document_embeddings
  USING hnsw (embedding vector_cosine_ops);
```

This pattern allows semantic search across all documents without restructuring any existing table.

---

### 19.4 Event Sourcing Readiness

The `audit_logs` table already captures `old_data` and `new_data` JSONB diffs. If the product ever requires event sourcing for a specific module (e.g., accounting), the existing audit trail provides the event log foundation. New `domain_events` table can be added:

```
domain_events
  id            UUID        PK
  tenant_id     UUID
  aggregate_type TEXT       -- "Invoice", "Subscription"
  aggregate_id  UUID
  event_type    TEXT        -- "InvoiceCreated", "PaymentProcessed"
  payload       JSONB
  version       INTEGER
  occurred_at   TIMESTAMPTZ
```

This decouples event sourcing to specific aggregates without touching the main tables.

---

## Part 20 — Summary Matrix

### Entity Ownership Matrix

| Entity | Scope | tenant_id | soft_delete | audit_logged | pii_present |
|---|---|---|---|---|---|
| tenants | Global | ❌ | ✅ | ✅ | ❌ |
| master_admins | Global | ❌ | ❌ | ✅ | ✅ |
| users | Tenant | ✅ | ✅ | ✅ | ✅ |
| businesses | Tenant | ✅ | ✅ | ✅ | ❌ |
| contacts | Tenant | ✅ | ✅ | ✅ | ✅ |
| clients | Tenant | ✅ | ✅ | ✅ | ❌ |
| documents | Tenant | ✅ | ✅ | ✅ | ❌ |
| tasks | Tenant | ✅ | ✅ | ✅ | ❌ |
| leads | Tenant | ✅ | ✅ | ✅ | ❌ |
| audit_logs | Tenant | ✅ | ❌ | ❌ (self) | ⚠️ |
| login_history | Tenant | ✅ | ❌ | ❌ | ✅ |
| invoices | Tenant | ✅ | ❌ | ✅ | ❌ |
| payments | Tenant | ✅ | ❌ | ✅ | ❌ |
| billing_plans | Global | ❌ | ❌ | ✅ | ❌ |
| permissions | Global | ❌ | ❌ | ✅ | ❌ |
| notifications | Tenant | ✅ | ❌ | ❌ | ❌ |
| tenant_branding | Tenant | ✅ | ❌ | ✅ | ❌ |
| smtp_configs | Tenant | ✅ | ❌ | ✅ | ✅ |

---

### Total Table Count

| Module | Table Count |
|---|---|
| Authentication | 10 |
| Tenant Management | 6 |
| Roles & Permissions | 5 |
| Businesses | 9 |
| Contacts | 6 |
| Clients | 6 |
| CRM | 9 |
| Documents | 13 |
| Tasks | 11 |
| Notifications | 7 |
| Billing & Subscriptions | 11 |
| Reports | 5 |
| Audit | 4 |
| Dashboard | 4 |
| Settings | 6 |
| White Label | 4 |
| **Total** | **121 tables** |

---

> **This blueprint is the authoritative source of truth for the CA Firm ERP database design.**
> Generated for: Bytesved CA Firm ERP Platform
> Architecture Version: 1.0
> PostgreSQL Target Version: 16.x
> Prisma ORM: 5.x
> Designed for 10-year lifecycle, thousands of tenants, millions of records.
