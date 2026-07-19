# CA Firm ERP — Database Architecture Review
> Principal Database Architect & Enterprise SaaS Reviewer
> Pre-Production Gate Review | PostgreSQL 16 + Prisma ORM
> Scale Target: 10,000+ Tenants · 500K+ Businesses · 5M+ Documents · Millions of Audit Logs

---

## Overall Architecture Score

| Dimension | Score | Verdict |
|---|---|---|
| Schema Design (Normalization) | 8/10 | ✅ Solid 3NF, good JSONB usage |
| Multi-Tenant Isolation | 7/10 | ⚠️ RLS implementation has gaps |
| RBAC Design | 7/10 | ⚠️ Missing delegation, resource-level permissions |
| Document Management | 7/10 | ⚠️ Versioning conflict risk, orphaned storage risk |
| Billing Model | 6/10 | ❌ GST/tax handling absent, credit notes not formalized |
| Audit & Compliance | 7/10 | ⚠️ Immutability not enforced at DDL level |
| Performance & Indexing | 7/10 | ⚠️ Several hot-path queries missing indexes |
| Notification System | 6/10 | ❌ Dead letter queue absent, provider fallback missing |
| Security | 6/10 | ❌ Column-level encryption strategy incomplete |
| Future Scalability | 8/10 | ✅ Extension patterns are solid |
| **Overall** | **78/100** | ⚠️ **NOT production-ready without addressing critical issues** |

> [!CAUTION]
> Do NOT proceed to Prisma schema generation until every **CRITICAL** issue in this review is resolved. Several issues represent data integrity risks, security vulnerabilities, and billing correctness failures that will be extremely expensive to fix post-launch.

---

## Section 1 — Critical Issues

> [!CAUTION]
> These are blocking issues. Each one can cause data loss, security breaches, billing errors, or system instability at scale.

---

### CRITICAL-01 — RLS `current_setting()` Failure Mode Is Silent

**Location:** Part 5, Section 5.4

**Problem:**
```sql
-- Current design:
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

If `SET LOCAL "app.current_tenant_id"` is **never called** (e.g., a background worker, a raw Prisma `$queryRaw`, a BullMQ job, a migration script, or a direct DB connection from a debugging session), `current_setting()` returns an empty string, which then **fails to cast to UUID and throws a PostgreSQL error** — or worse, in permissive mode, returns **zero rows** silently, masking a tenant isolation failure.

**The Real Risk:** A developer writes a Prisma `$queryRaw` for a report query. They forget to set the session variable. PostgreSQL silently returns zero rows. No error. No tenant bleed. But the query produces wrong data. This is undetectable.

**Fix Required:**
```sql
-- Use the 'missing_ok' = false parameter (throws error if not set)
current_setting('app.current_tenant_id', false)::UUID

-- AND add a default deny policy in addition to the tenant policy
CREATE POLICY deny_unscoped ON documents
  AS RESTRICTIVE
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
         AND current_setting('app.current_tenant_id', true) != '');
```

Additionally, document the mandatory rule: **Every Prisma middleware transaction MUST call `SET LOCAL`**. This must be enforced by the `BaseRepository`, not left to developers.

---

### CRITICAL-02 — Polymorphic `entity_id` on Clients Has No Foreign Key Constraint

**Location:** Part 4, Section 4.5 — `clients` table

**Problem:**
```
client.entity_type = 'BUSINESS' | 'CONTACT'
client.entity_id = UUID  -- NO FK constraint possible on polymorphic column
```

This means a `client` row can have an `entity_id` pointing to a **deleted**, **non-existent**, or **wrong-tenant** business or contact. There is zero database-level referential integrity. At scale, with 500K businesses and millions of soft-deletes, orphaned client records are inevitable.

**Fix Required:** Use **two nullable FK columns** instead of a polymorphic reference:
```
clients
  business_id   UUID  NULL  FK → businesses.id
  contact_id    UUID  NULL  FK → contacts.id
  -- Enforce: exactly one must be non-null
  CONSTRAINT chk_client_entity CHECK (
    (business_id IS NOT NULL AND contact_id IS NULL)
    OR
    (business_id IS NULL AND contact_id IS NOT NULL)
  )
```
This gives you real FK constraints, real cascade behavior, and real JOIN performance.

The same problem exists in `task_links` and `document_links` polymorphic tables. These need a different fix — see CRITICAL-03.

---

### CRITICAL-03 — Polymorphic Link Tables Cannot Be FK-Enforced

**Location:** `task_links`, `document_links`

**Problem:** Both tables use `(linked_type, linked_id)` pattern. This is an anti-pattern for anything that requires referential integrity. If a client is deleted, `task_links` rows pointing to that client become orphaned. No cascade, no constraint enforcement.

**Fix Required:** For `task_links` and `document_links`, use **typed junction tables** instead:
```
-- Instead of one polymorphic table, use:
task_client_links       (task_id FK, client_id FK)
task_document_links     (task_id FK, document_id FK)
task_lead_links         (task_id FK, lead_id FK)
task_business_links     (task_id FK, business_id FK)

document_client_links   (document_id FK, client_id FK)
document_business_links (document_id FK, business_id FK)
document_task_links     (document_id FK, task_id FK)
```

Yes, this is more tables. But each has proper FK constraints, proper indexes, and proper cascade behavior. Polymorphic references are a known PostgreSQL anti-pattern for high-volume tables.

---

### CRITICAL-04 — `document_versions.is_current` Race Condition

**Location:** Part 8, Section 8.4

**Problem:**
```
document_versions
  is_current  BOOLEAN DEFAULT false
```

When two concurrent uploads happen for the same document, both background workers can race to set `is_current = true`. You now have **two rows claiming to be the current version**. Queries that join on `is_current = true` return duplicate rows. Reports show wrong document content.

**Fix Required:** Remove the `is_current` boolean entirely. Instead:

**Option A (Recommended):** Store `current_version_id UUID FK → document_versions.id` directly on the `documents` table. Single column update, atomic, no race condition.

**Option B:** Use a `UNIQUE NULLS NOT DISTINCT` partial index:
```sql
CREATE UNIQUE INDEX idx_doc_current_version
  ON document_versions (document_id)
  WHERE is_current = true;
```
This enforces at most one `is_current = true` per document at the database level.

---

### CRITICAL-05 — Audit Log Immutability Is Only "Documented", Not Enforced

**Location:** Part 13, Section 13.1

**Problem:** The design says:
> "No UPDATE or DELETE on this table ever. Enforced at DB level via a trigger..."

But the trigger is not defined in the architecture. More critically, Prisma ORM, raw SQL scripts, and admin tools (pgAdmin, psql, DBeaver) can still `DELETE FROM audit_logs WHERE ...` unless the rule is actually enforced.

**Fix Required:** Define the enforcement at three levels:

**Level 1 — PostgreSQL trigger (non-bypassable):**
```sql
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is immutable. UPDATE and DELETE are forbidden.';
END;
$$;

CREATE TRIGGER audit_immutability
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
```

**Level 2 — Revoke DELETE/UPDATE from application DB role:**
```sql
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
REVOKE UPDATE, DELETE ON login_history FROM app_user;
```

**Level 3 — Separate DB role for audit:** The application writes audit logs via a dedicated `audit_writer` role that has only `INSERT` on audit tables. The main `app_user` role cannot write to audit tables at all.

---

### CRITICAL-06 — GST & Tax Completely Absent from Billing Model

**Location:** Part 12 — Billing Model

**Problem:** This is a CA Firm ERP operating in India. The billing module generates invoices. Yet:

- **No GST columns** on `invoices` (CGST, SGST, IGST, UGST)
- **No GSTIN** on tenants for their own GST registration
- **No HSN/SAC codes** on plan features or invoice line items
- **No TDS** deduction tracking on payments
- **No credit note** formal table (mentioned as "correction creates negative invoice" but not modeled)
- **No proforma invoice** support

This is not a "nice-to-have." CA Firms are **required by GST law** to issue GST-compliant invoices. The billing module as designed **cannot produce a legal tax invoice in India**.

**Fix Required — Add to `invoices`:**
```
invoice_type        ENUM (INVOICE, CREDIT_NOTE, PROFORMA, RECEIPT)
original_invoice_id UUID NULL FK → invoices.id  -- For credit notes
gstin_supplier      TEXT                          -- Tenant's GSTIN
gstin_recipient     TEXT NULL                     -- Buyer's GSTIN if B2B
place_of_supply     CHAR(2)                       -- State code
igst_amount         DECIMAL(15,2) DEFAULT 0
cgst_amount         DECIMAL(15,2) DEFAULT 0
sgst_amount         DECIMAL(15,2) DEFAULT 0
ugst_amount         DECIMAL(15,2) DEFAULT 0
tds_amount          DECIMAL(15,2) DEFAULT 0
reverse_charge      BOOLEAN DEFAULT false
irn                 TEXT NULL                     -- Invoice Reference Number (GST e-invoice)
ack_number          TEXT NULL                     -- GSTN acknowledgement
e_way_bill_number   TEXT NULL
```

**Fix Required — Add to `invoice_line_items`:**
```
hsn_sac_code        TEXT NULL        -- HSN for goods, SAC for services
tax_rate            DECIMAL(5,2)
igst_rate           DECIMAL(5,2) DEFAULT 0
cgst_rate           DECIMAL(5,2) DEFAULT 0
sgst_rate           DECIMAL(5,2) DEFAULT 0
```

---

### CRITICAL-07 — No Tenant-Level DB Connection Isolation in PgBouncer

**Location:** Part 17, Section 17.5

**Problem:** The design specifies PgBouncer in **transaction mode** with a single pool. This means:
1. Tenant A's transaction and Tenant B's transaction can share the same DB connection from PgBouncer's pool.
2. When `SET LOCAL "app.current_tenant_id"` is used in transaction mode, the `SET LOCAL` is scoped to the **transaction**, not the session. This is correct behavior.
3. **BUT:** If any code calls `SET SESSION` instead of `SET LOCAL` — a common developer mistake — the session variable leaks to the next tenant using that connection.

**Fix Required:**
- Enforce `SET LOCAL` (never `SET SESSION`) in BaseRepository — this must be a non-negotiable architecture rule with a lint rule or a code review checklist item.
- Add a connection validation query in PgBouncer: `SELECT pg_advisory_lock_shared(hashtext(current_setting('app.current_tenant_id', true)))` — this surfaces misuse immediately.
- Document explicitly: **The RLS strategy is only safe with `SET LOCAL` in transaction mode PgBouncer.**

---

### CRITICAL-08 — `user_sessions` Has No Expiry Enforcement at DB Level

**Location:** Part 3, Authentication section

**Problem:** The `user_sessions` table is mentioned but never fully defined. There is no `expires_at` column defined in the architecture. Sessions grow unbounded. At 10,000 tenants with 50 users each and multiple device sessions, you accumulate millions of session rows with no cleanup strategy.

**Fix Required — Full `user_sessions` definition:**
```
user_sessions
  id              UUID        PK
  tenant_id       UUID        FK → tenants.id
  user_id         UUID        FK → users.id
  token_hash      TEXT        UNIQUE      -- SHA-256 of session token
  device_type     ENUM        (WEB, MOBILE_IOS, MOBILE_ANDROID, DESKTOP, API)
  device_name     TEXT        NULL
  ip_address      INET        NULL
  user_agent      TEXT        NULL
  location_city   TEXT        NULL
  location_country CHAR(2)   NULL
  is_active       BOOLEAN     DEFAULT true
  created_at      TIMESTAMPTZ DEFAULT now()
  expires_at      TIMESTAMPTZ NOT NULL    -- Hard expiry
  last_active_at  TIMESTAMPTZ DEFAULT now()
  revoked_at      TIMESTAMPTZ NULL
  revoke_reason   ENUM        NULL (LOGOUT, PASSWORD_CHANGE, ADMIN_REVOKE, EXPIRED, SUSPICIOUS)
```

**Add a BullMQ cleanup job:** Purge expired sessions daily. Add a partial index:
```sql
CREATE INDEX idx_sessions_cleanup ON user_sessions (expires_at)
  WHERE is_active = true;
```

---

### CRITICAL-09 — `business_compliance_status.period` Is a Free-Text String

**Location:** Part 7, Section 7.6

**Problem:**
```
period  TEXT  -- "FY2024-25", "Q1-2025", "Oct-2024"
```

This is a compliance-tracking table for a CA Firm ERP. The `period` column being free text means:
- No way to query "all compliance items due in Q1 FY2025" without LIKE pattern matching
- Inconsistent data entry ("FY24-25", "2024-25", "FY 2024-25")
- Cannot sort by period chronologically
- Cannot calculate overdue items accurately
- Cannot do "show all pending GST returns for the next 3 months"

**Fix Required:**
```
period_type    ENUM        (MONTHLY, QUARTERLY, HALF_YEARLY, ANNUALLY, CUSTOM)
period_start   DATE        NOT NULL
period_end     DATE        NOT NULL
-- Remove: period TEXT
```

Add a check constraint:
```sql
CONSTRAINT chk_compliance_period CHECK (period_end > period_start)
```

Now you can query: `WHERE period_end BETWEEN now() AND now() + INTERVAL '90 days'`

---

### CRITICAL-10 — `notification_deliveries` Has No Dead Letter Queue Strategy

**Location:** Part 11, Section 11.3

**Problem:** The `notification_deliveries` table tracks retry attempts but has no concept of a **dead letter queue** (DLQ). After `max_retries` attempts, failed notifications simply sit in the table with `status = FAILED`. There is:
- No alerting mechanism when notifications permanently fail
- No way for admins to inspect and replay failed notifications
- No provider fallback (e.g., if SendGrid fails, try SES)
- No batch notification support (e.g., digest emails every hour)

**Fix Required — Add to `notification_deliveries`:**
```
max_attempts        SMALLINT    DEFAULT 3
is_dead_lettered    BOOLEAN     DEFAULT false
dead_lettered_at    TIMESTAMPTZ NULL
dead_letter_reason  TEXT        NULL
fallback_channel    ENUM        NULL   -- Channel to try if primary fails
parent_delivery_id  UUID        NULL FK → notification_deliveries.id  -- Fallback chain
```

**Add `notification_digests` table:**
```
notification_digests
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  user_id         UUID    FK → users.id
  digest_type     ENUM    (HOURLY, DAILY, WEEKLY)
  scheduled_for   TIMESTAMPTZ
  status          ENUM    (PENDING, SENT, FAILED)
  notification_ids UUID[] NOT NULL  -- Array of notification IDs included
  sent_at         TIMESTAMPTZ NULL
  created_at      TIMESTAMPTZ
```

---

### CRITICAL-11 — `refresh_tokens` Has No Device Binding or Family Tracking

**Location:** Part 3, Authentication section

**Problem:** `refresh_tokens` is listed but never defined. In a multi-device CA Firm scenario, refresh token theft is a serious attack vector. Without **refresh token rotation families**, a stolen refresh token can be used indefinitely to generate new access tokens.

**Fix Required — Full `refresh_tokens` definition:**
```
refresh_tokens
  id              UUID        PK
  tenant_id       UUID        FK → tenants.id
  user_id         UUID        FK → users.id
  session_id      UUID        FK → user_sessions.id
  token_hash      TEXT        UNIQUE      -- SHA-256, never store plaintext
  family_id       UUID        NOT NULL    -- Rotation family tracking
  is_used         BOOLEAN     DEFAULT false   -- True after rotation
  used_at         TIMESTAMPTZ NULL
  expires_at      TIMESTAMPTZ NOT NULL
  created_at      TIMESTAMPTZ DEFAULT now()
  revoked_at      TIMESTAMPTZ NULL
```

**Rotation rule:** When a refresh token is used, mark `is_used = true`, issue new token in same `family_id`. If a used token is presented again, **revoke the entire family** (detect token theft).

---

### CRITICAL-12 — No `tenants` Subscription Status Cache Column

**Location:** Part 5 — Tenant table

**Problem:** The `tenants` table has a `status` enum but does NOT cache the subscription status. Every request that needs to check "is this tenant on an active paid plan?" must JOIN `tenants → subscriptions → billing_plans → plan_feature_map`.

At 10,000 tenants × millions of requests, this JOIN is on the critical request path (tenant middleware). Even with Redis caching, cache misses hit the DB. The `tenants` table needs denormalized subscription context.

**Fix Required — Add to `tenants`:**
```
subscription_status     ENUM    (TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED)
subscription_expires_at TIMESTAMPTZ NULL
plan_code               TEXT    NULL    -- Denormalized for fast limit checks
max_users               INTEGER NULL   -- Denormalized plan limit
max_storage_gb          INTEGER NULL   -- Denormalized plan limit
max_clients             INTEGER NULL   -- Denormalized plan limit
```

These columns are updated by a webhook/worker when subscription status changes. Cache-aside pattern with Redis. Eliminates the 4-table JOIN from the tenant middleware hot path.

---

### CRITICAL-13 — No `contact_identifiers.aadhaar_number` Encryption Strategy at Column Level

**Location:** Part 18, Section 18.2

**Problem:** The design mentions column-level encryption for Aadhaar numbers but does not specify:
- **Which encryption mode** (deterministic vs. randomized AES-256-GCM)
- **How search works on encrypted data** (you cannot `WHERE aadhaar = ?` on encrypted columns unless using deterministic encryption)
- **Where the key lives** (KMS reference format, rotation strategy)
- **Who can decrypt** (application vs. DB vs. DBA)

This is critical because Aadhaar is protected under **DPDPA 2023** (India's data protection law). Storing it in plaintext TEXT column is a regulatory violation.

**Fix Required:**
- Use **deterministic AES-256-SIV** for Aadhaar (allows equality search without decryption)
- Store `aadhaar_encrypted TEXT` + `aadhaar_last4 CHAR(4)` (for display without decryption)
- Add `aadhaar_hash TEXT` (HMAC-SHA256 with server secret) for search
- Key stored in AWS KMS, referenced by `encryption_key_version` column for rotation

---

### CRITICAL-14 — `custom_field_values` Has No Type Safety or Validation

**Location:** Part 3, Settings section

**Problem:**
```
custom_field_values
  value   TEXT   -- Stores everything as text
```

A custom field defined as `DATE` can have a value of `"not a date"`. A `NUMBER` field can store `"abc"`. There is no validation, no type enforcement, and no way to query `WHERE value > 100` on numeric fields.

**Fix Required — Add typed value columns:**
```
custom_field_values
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  field_id        UUID    FK → custom_field_definitions.id
  entity_type     TEXT
  entity_id       UUID
  -- Typed value storage (only one will be non-null)
  value_text      TEXT    NULL
  value_number    DECIMAL(20,6) NULL
  value_boolean   BOOLEAN NULL
  value_date      DATE    NULL
  value_datetime  TIMESTAMPTZ NULL
  value_json      JSONB   NULL   -- For MULTISELECT, complex types
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  UNIQUE (field_id, entity_type, entity_id)
```

Add a check constraint ensuring only the appropriate value column is populated based on `field_id.field_type`.

---

## Section 2 — Medium Issues

> [!WARNING]
> These issues will cause problems as the platform scales. Address before launch.

---

### MEDIUM-01 — `tasks.actual_hours` Is a Denormalized Aggregate Without a Consistency Guarantee

**Problem:** `tasks.actual_hours` says "Sum of time logs" but there's no trigger to keep it synchronized. If a time log is edited or deleted, `actual_hours` becomes stale. At scale, reporting on task hours will be inaccurate.

**Fix:** Either remove `actual_hours` and always compute `SUM(task_time_logs.duration_mins)` with a materialized view, OR add a PostgreSQL trigger on `task_time_logs` INSERT/UPDATE/DELETE to recompute.

---

### MEDIUM-02 — `documents.current_version` Integer Counter Has No Atomic Guarantee

**Problem:** `documents.current_version INTEGER DEFAULT 1` is incremented in application code. Two simultaneous uploads will both read `current_version = 5` and both write `current_version = 6`, creating a duplicate version number. The `UNIQUE (document_id, version_number)` constraint will catch it — but as a transaction error, not gracefully.

**Fix:** Use PostgreSQL sequence or `SELECT ... FOR UPDATE` on the document row before version creation. Or use `version_number = (SELECT MAX(version_number) + 1 FROM document_versions WHERE document_id = ?)` inside an atomic transaction.

---

### MEDIUM-03 — `business_compliance_status` Has No Unique Constraint

**Problem:** Nothing prevents two rows with `(business_id, compliance_type, period_start, period_end)`. You get duplicate compliance records for the same obligation, which breaks reporting.

**Fix:** Add:
```sql
UNIQUE (tenant_id, business_id, compliance_type, period_start, period_end)
```

---

### MEDIUM-04 — `pipelines` Has No Constraint Ensuring One Default Per Tenant

**Problem:**
```
pipelines.is_default  BOOLEAN DEFAULT false
```

Two pipelines can both have `is_default = true` for the same tenant. Application logic handles this, but it's not enforced at DB level.

**Fix:**
```sql
CREATE UNIQUE INDEX idx_pipelines_default_per_tenant
  ON pipelines (tenant_id)
  WHERE is_default = true;
```

Same problem exists for `dashboard_layouts.is_default` and `firm_settings` (but this is already 1:1).

---

### MEDIUM-05 — `leads` Table Mixes Contact Data and Contact FK

**Problem:**
```
leads
  company_name  TEXT  NULL   -- Duplicated from contact
  contact_name  TEXT  NULL   -- Free text, no FK
  email         TEXT  NULL   -- Free text, no FK
  phone         TEXT  NULL
```

When a lead is converted to a client, these free-text fields are abandoned. The lead's contact info is never formally linked. There's no way to de-duplicate leads against existing contacts.

**Fix:** Add optional FK columns:
```
contact_id      UUID  NULL  FK → contacts.id     -- Link to existing contact if matched
business_id     UUID  NULL  FK → businesses.id   -- Link to existing business if matched
```
Keep the free-text fields for unmatched leads, but allow promoting them to full entities.

---

### MEDIUM-06 — No `subscription_history` Full Schema Defined

**Problem:** `subscription_history` appears in the entity list but is never defined. Plan upgrades and downgrades affect prorated billing. Without a complete history, you cannot:
- Calculate proration
- Answer "what plan was tenant X on in March 2025?"
- Handle disputed charges

**Fix — Define fully:**
```
subscription_history
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  subscription_id UUID    FK → subscriptions.id
  event_type      ENUM    (CREATED, UPGRADED, DOWNGRADED, RENEWED, SUSPENDED, CANCELLED, REACTIVATED)
  from_plan_id    UUID    NULL FK → billing_plans.id
  to_plan_id      UUID    NULL FK → billing_plans.id
  from_cycle      ENUM    NULL (MONTHLY, ANNUALLY)
  to_cycle        ENUM    NULL
  proration_amount DECIMAL(15,2) NULL
  effective_date  DATE    NOT NULL
  changed_by      UUID    NULL FK → users.id   -- NULL = system/webhook
  gateway_event_id TEXT   NULL
  notes           TEXT    NULL
  created_at      TIMESTAMPTZ
```

---

### MEDIUM-07 — `document_approvals` Has No Workflow Definition Table

**Problem:** Document approval sequences are stored as rows in `document_approvals` with a `sequence` integer. But there's no concept of an **approval workflow template** that defines who approves what, in what order, for which document categories. Every document's approval chain is ad-hoc.

**Fix — Add:**
```
approval_workflow_templates
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  name            TEXT
  category_id     UUID    NULL FK → document_categories.id
  is_default      BOOLEAN DEFAULT false
  created_at      TIMESTAMPTZ

approval_workflow_steps
  id              UUID    PK
  template_id     UUID    FK → approval_workflow_templates.id
  sequence        INTEGER
  approver_role_id UUID   NULL FK → roles.id    -- Role-based approval
  approver_user_id UUID   NULL FK → users.id    -- User-specific approval
  is_required     BOOLEAN DEFAULT true
  deadline_hours  INTEGER NULL
```

---

### MEDIUM-08 — `user_invitations` Is Never Defined

**Problem:** `user_invitations` appears in the entity list but has no schema. Invitation expiry, token security, and role assignment at invite time are all undefined.

**Fix — Define:**
```
user_invitations
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  email           TEXT    NOT NULL
  invited_by      UUID    FK → users.id
  role_ids        UUID[]  NOT NULL      -- Roles to assign on acceptance
  token_hash      TEXT    UNIQUE        -- SHA-256 of invitation token
  status          ENUM    (PENDING, ACCEPTED, EXPIRED, REVOKED)
  expires_at      TIMESTAMPTZ NOT NULL  -- 7 days default
  accepted_at     TIMESTAMPTZ NULL
  accepted_by     UUID    NULL FK → users.id
  message         TEXT    NULL
  created_at      TIMESTAMPTZ
  UNIQUE (tenant_id, email) WHERE status = 'PENDING'
```

---

### MEDIUM-09 — `firm_settings` and `user_settings` Are Undefined Blobs

**Problem:** Both tables appear in the entity list with no schema. A "settings" table stored as a single JSONB blob per tenant has serious versioning problems — you cannot query individual settings, cannot enforce types, and cannot migrate specific settings without deserializing and re-serializing all settings for every tenant.

**Fix:** Use a **key-value settings pattern** with typed columns:
```
firm_settings
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id UNIQUE
  -- Explicit columns for known settings (queryable, typed):
  timezone        TEXT    DEFAULT 'Asia/Kolkata'
  date_format     TEXT    DEFAULT 'DD/MM/YYYY'
  currency        CHAR(3) DEFAULT 'INR'
  fiscal_year_start SMALLINT DEFAULT 4
  default_language TEXT   DEFAULT 'en'
  max_login_attempts SMALLINT DEFAULT 5
  session_timeout_mins INTEGER DEFAULT 480
  require_mfa     BOOLEAN DEFAULT false
  allow_client_portal BOOLEAN DEFAULT false
  watermark_documents BOOLEAN DEFAULT false
  -- Overflow for future/custom settings:
  extra_settings  JSONB   NULL
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

---

### MEDIUM-10 — `report_definitions` Has No Schema or Security Model

**Problem:** Report definitions appear in the entity list but are never defined. Who can create reports? Can reports access data across clients? Can a report definition be shared? There's no permission scoping.

**Fix — Define:**
```
report_definitions
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  name            TEXT
  description     TEXT    NULL
  type            ENUM    (STANDARD, CUSTOM, COMPLIANCE, FINANCIAL)
  query_config    JSONB   NOT NULL    -- Report parameters, filters, columns
  output_format   ENUM    (PDF, EXCEL, CSV, JSON)
  is_system       BOOLEAN DEFAULT false
  is_shared       BOOLEAN DEFAULT false  -- Shared across tenant users
  created_by      UUID    FK → users.id
  required_permission TEXT NULL          -- Permission code needed to run
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

---

### MEDIUM-11 — Task `recurrence_rule` (iCal RRULE) Has No Validation

**Problem:** `tasks.recurrence_rule TEXT NULL` stores an iCal RRULE string. There is no validation, no parsing strategy defined, and no mechanism to generate the next occurrence. `next_occurrence` is also stored as a column — but who updates it, and when?

**Fix:** Add a `task_recurrence_queue` or use a BullMQ delayed job. Define the pattern: after a recurring task is completed, a BullMQ job creates the next occurrence and updates `next_occurrence`. The RRULE string must be validated by a library (e.g., `rrule` npm package) at the API layer before storage.

---

### MEDIUM-12 — No Index on `business_identifiers.value` for PAN/GSTIN Lookup

**Problem:** CA Firm users will search by PAN, GSTIN, and CIN constantly. The `business_identifiers` table has `UNIQUE (tenant_id, type, value)` but no standalone index on `(tenant_id, type)` for "find all GSTINs for this tenant" queries.

**Fix:**
```sql
-- For fast lookup by type within tenant
CREATE INDEX idx_business_identifiers_type ON business_identifiers (tenant_id, type);

-- For cross-tenant PAN search (master admin only)
CREATE INDEX idx_business_identifiers_pan ON business_identifiers (value)
  WHERE type = 'PAN';

-- Trigram for fuzzy GSTIN/PAN search
CREATE INDEX idx_business_identifiers_trgm ON business_identifiers
  USING GIN (value gin_trgm_ops);
```

---

### MEDIUM-13 — `otp_codes` Has No Rate Limit or Attempt Tracking at DB Level

**Problem:** OTP brute-force protection is mentioned via `account_lockouts` table but there is no link between OTP attempts and the lockout mechanism. The `otp_codes` table is undefined — no expiry enforcement, no attempt counter.

**Fix — Define fully:**
```
otp_codes
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  user_id         UUID    NULL FK → users.id
  email           TEXT    NULL    -- For pre-auth OTPs
  purpose         ENUM    (EMAIL_VERIFY, PHONE_VERIFY, TWO_FACTOR, PASSWORD_RESET)
  code_hash       TEXT    NOT NULL  -- NEVER store plaintext OTP
  attempt_count   SMALLINT DEFAULT 0
  max_attempts    SMALLINT DEFAULT 5
  is_used         BOOLEAN  DEFAULT false
  used_at         TIMESTAMPTZ NULL
  expires_at      TIMESTAMPTZ NOT NULL
  created_at      TIMESTAMPTZ
  -- Auto-cleanup: delete WHERE expires_at < now() - INTERVAL '24 hours'
```

Add partial index for active OTP lookup:
```sql
CREATE INDEX idx_otp_active ON otp_codes (user_id, purpose, expires_at)
  WHERE is_used = false;
```

---

### MEDIUM-14 — No `payment_gateway_events` Full Schema or Idempotency Key

**Problem:** `payment_gateway_events` is in the entity list but undefined. Payment webhooks from Razorpay/Stripe must be idempotent — the same webhook can be delivered multiple times. Without an idempotency key, a payment could be recorded twice.

**Fix — Define:**
```
payment_gateway_events
  id                UUID    PK
  tenant_id         UUID    NULL FK → tenants.id
  gateway           ENUM    (RAZORPAY, STRIPE, PAYU, CASHFREE)
  event_type        TEXT    NOT NULL    -- "payment.captured", "subscription.renewed"
  gateway_event_id  TEXT    UNIQUE NOT NULL  -- Idempotency key from gateway
  payload           JSONB   NOT NULL
  processed         BOOLEAN DEFAULT false
  processed_at      TIMESTAMPTZ NULL
  processing_error  TEXT    NULL
  received_at       TIMESTAMPTZ DEFAULT now()
```

`UNIQUE (gateway_event_id)` prevents double-processing.

---

### MEDIUM-15 — `document_shares.share_token` Has No Rate Limit or Access Tracking

**Problem:** Public links with `share_token` have `max_downloads` and `download_count` but no rate limiting per IP. A link shared publicly can be scraped or downloaded in bulk.

**Fix — Add to `document_share_access_logs`:**
```
document_share_access_logs
  id              UUID    PK
  share_id        UUID    FK → document_shares.id
  ip_address      INET    NOT NULL
  user_agent      TEXT    NULL
  accessed_at     TIMESTAMPTZ DEFAULT now()
  action          ENUM    (VIEW, DOWNLOAD, FAILED_PASSWORD)
  country         CHAR(2) NULL
```

Add Redis rate limiting by IP per `share_id`. Enforce `max_downloads` check in an atomic Redis operation, not application code.

---

### MEDIUM-16 — RBAC Has No Resource-Level Permission Scoping

**Problem:** The RBAC model defines permissions as `clients:read` — this grants read access to **all clients in the tenant**. In a large CA firm with 200 clients and 30 staff, a junior staff member assigned to 5 clients should NOT see the other 195 clients.

The design acknowledges this in passing ("Future: per-user permission overrides") but this is a **core business requirement** for CA firms, not a future feature.

**Fix — Add resource-scoped permission layer:**
```
resource_access_policies
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  user_id         UUID    FK → users.id
  resource_type   TEXT    NOT NULL    -- "client", "business", "document"
  resource_id     UUID    NOT NULL    -- Specific entity ID
  access_level    ENUM    (READ, WRITE, ADMIN, NONE)
  granted_by      UUID    FK → users.id
  expires_at      TIMESTAMPTZ NULL
  created_at      TIMESTAMPTZ
  UNIQUE (tenant_id, user_id, resource_type, resource_id)
```

Resolution: Role permission = floor, resource policy = ceiling. If user has `clients:read` but `resource_access_policies` has `NONE` for a specific client, deny access.

---

### MEDIUM-17 — `mfa_configs` Is Undefined

**Problem:** `mfa_configs` appears in the entity list but has no schema. TOTP, SMS OTP, and backup codes are all different MFA methods with different storage needs.

**Fix — Define:**
```
mfa_configs
  id                  UUID    PK
  tenant_id           UUID    FK → tenants.id
  user_id             UUID    FK → users.id UNIQUE
  totp_secret_encrypted TEXT  NULL    -- Encrypted TOTP secret (AES-256)
  totp_enabled        BOOLEAN DEFAULT false
  totp_verified_at    TIMESTAMPTZ NULL
  sms_enabled         BOOLEAN DEFAULT false
  sms_phone           TEXT    NULL    -- Encrypted
  backup_codes        TEXT[]  NULL    -- Array of hashed backup codes
  backup_codes_generated_at TIMESTAMPTZ NULL
  last_used_at        TIMESTAMPTZ NULL
  created_at          TIMESTAMPTZ
  updated_at          TIMESTAMPTZ
```

---

### MEDIUM-18 — `contact_business_roles` vs `business_contacts` Confusion

**Problem:** The entity list has both:
- `business_contacts` — "Link businesses to contacts with roles"
- `contact_business_roles` — "Many-to-many: contacts ↔ businesses with roles"

These are the **same concept described twice** as two separate tables. This will cause confusion in implementation — which table does what?

**Fix:** Consolidate into one canonical junction table:
```
entity_contact_roles   (replaces both)
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  contact_id      UUID    FK → contacts.id
  business_id     UUID    FK → businesses.id
  role_type       TEXT    -- "DIRECTOR", "PARTNER", "TRUSTEE", "SIGNATORY"
  din             TEXT    NULL  -- Director Identification Number
  appointment_date DATE   NULL
  cessation_date  DATE    NULL
  is_active       BOOLEAN DEFAULT true
  created_at      TIMESTAMPTZ
  UNIQUE (tenant_id, contact_id, business_id, role_type)
```

---

### MEDIUM-19 — No `tenants.country` or Multi-Currency Strategy

**Problem:** The platform is designed for India but the design says "future: multi-region deployment." However:
- `tenants` has no `country` column
- `businesses.currency` defaults to `'INR'` but there's no multi-currency exchange rate handling
- Invoices have `currency` but no exchange rate reference

**Fix — Add to `tenants`:**
```
country         CHAR(2)   DEFAULT 'IN'
timezone        TEXT      DEFAULT 'Asia/Kolkata'
locale          TEXT      DEFAULT 'en-IN'
default_currency CHAR(3)  DEFAULT 'INR'
```

---

### MEDIUM-20 — `document_folders.path` Materialized Path Is Not Maintained by DB

**Problem:**
```
document_folders
  path  TEXT  -- Materialized path: "/root/clients/sharma-ltd/"
```

This path must be recalculated when:
- A folder is renamed
- A folder is moved to a different parent

There's no trigger, no validation, and no enforcement. At scale, a bulk folder move operation will leave the `path` column inconsistent.

**Fix:** Use PostgreSQL `ltree` extension for hierarchical paths instead of TEXT:
```sql
CREATE EXTENSION ltree;
-- path stored as ltree: "root.clients.sharma_ltd.documents"
```

Or, add a trigger that recalculates `path` for all descendants when a folder's `name` or `parent_id` changes.

---

### MEDIUM-21 — `saved_filters` and `report_schedules` Are Duplicated Concepts

**Problem:** The design has:
- `saved_filters` in the Reports module
- `saved_dashboard_filters` in the Dashboard module
- `report_schedules` in the Reports module

These are three separate tables for what is largely the same concept (saved query configurations). Over time this creates maintenance burden and confuses developers about where to add a new filter type.

**Fix:** Consolidate into:
```
saved_queries
  id              UUID    PK
  tenant_id       UUID    FK → tenants.id
  user_id         UUID    FK → users.id
  context         ENUM    (REPORT, DASHBOARD, LIST_VIEW, EXPORT)
  resource        TEXT    -- "clients", "tasks", "documents"
  name            TEXT
  filters         JSONB
  columns         JSONB   NULL    -- For list view column preferences
  is_default      BOOLEAN DEFAULT false
  is_shared       BOOLEAN DEFAULT false
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

---

## Section 3 — Missing Tables

The following tables are required but entirely absent from the architecture:

| Missing Table | Module | Why Needed |
|---|---|---|
| `approval_workflow_templates` | Documents | Reusable approval chains per document category |
| `approval_workflow_steps` | Documents | Steps within templates (role/user based) |
| `tenant_feature_overrides` | Billing | Enterprise tenants get feature exceptions beyond their plan |
| `credit_notes` | Billing | Formal credit note records (not just negative invoices) |
| `tax_rates` | Billing | GST rate definitions (0%, 5%, 12%, 18%, 28%) |
| `hsn_sac_codes` | Billing | HSN/SAC code lookup for GST-compliant invoicing |
| `payment_refunds` | Billing | Refund records separate from payments |
| `client_portal_users` | Clients | External portal access for clients (future, but schema needed now) |
| `api_keys` | Settings | Public API key management for future API access |
| `api_request_logs` | Audit | Track external API key usage |
| `webhook_endpoints` | Integrations | Tenant-configured outbound webhook URLs |
| `webhook_deliveries` | Integrations | Outbound webhook delivery logs |
| `file_quarantine` | Documents | Files flagged by antivirus scanning before approval |
| `email_logs` | Notifications | Outbound email audit trail (separate from delivery status) |
| `sms_logs` | Notifications | Outbound SMS audit trail |
| `document_comments` | Documents | Inline comments on documents (distinct from task comments) |
| `entity_tags` | Cross-module | Universal tagging system for clients, businesses, contacts |
| `tag_definitions` | Cross-module | Tag taxonomy per tenant |
| `user_activity_logs` | Audit | Application-level read activity (page views, searches) |
| `scheduled_jobs` | Workers | BullMQ job registry for tracking scheduled work |
| `system_health_metrics` | Platform | Platform-level metrics for master admin dashboard |
| `tenant_usage_snapshots` | Billing | Daily snapshots of tenant usage for billing calculations |
| `business_bank_accounts` | Businesses | Bank account details per business entity |
| `contact_emergency_contacts` | Contacts | Emergency contact for individual persons |
| `document_ocr_results` | Documents | OCR output table (baked in now for future use) |
| `letter_templates` | Documents | Engagement letter, representation letter templates |
| `client_communications` | CRM/Clients | Email/call records between firm and client (post-conversion) |

---

## Section 4 — Missing Relationships

| Missing Relationship | Between | Type | Impact |
|---|---|---|---|
| `contacts.client_id` | contacts → clients | M:1 (nullable) | A contact may be a client directly |
| `businesses → clients` | businesses → clients | 1:1 (nullable) | A business may be a client |
| `tasks → project_id` | tasks → projects | M:1 | No project grouping concept |
| `document_versions → document_approvals` | versions → approvals | Weak | Approval tied to version not document |
| `notifications → notification_deliveries` | 1:M | Missing cascade | Deliveries left orphaned if notification deleted |
| `invoices → subscriptions` | M:1 | Missing explicit | Invoice must trace to subscription period |
| `user_sessions → refresh_tokens` | 1:M | Not defined | Sessions don't know their tokens |
| `lead_activities → task_id` | lead_activities → tasks | M:1 (nullable) | Activity of type TASK should link to actual task |
| `business_compliance_status → task_id` | compliance → tasks | M:1 (nullable) | Compliance filing should link to tracking task |
| `client_engagement_letters → documents` | letters → documents | M:1 | Letter should reference the uploaded document |
| `coupon_codes → billing_plans` | coupons → plans | M:M | Coupons may be plan-specific |
| `business_financial_years → business_compliance_status` | FY → compliance | 1:M | All compliance in an FY grouped by FY record |
| `task_templates → task_template_checklists` | 1:M | Not defined | Checklist items for templates never related |
| `users → master_admins` | users → master_admins | Separate hierarchy | Need to clarify if master admins use same user table |
| `payment_gateway_configs → payments` | gateway config → payment | 1:M | Which gateway config was used for each payment |
| `tenant_branding → smtp_configs` | branding → smtp | Not linked | SMTP used for white-label emails should link to branding |
| `document_retention_policies → documents` | policies → documents | 1:M | Documents should explicitly reference their retention policy |
| `business_assignments → client_assignments` | business → client | Should cascade | If a user is assigned to a business, they often need access to its client record |
| `roles → roles` (inheritance) | roles → parent role | Self-referential | Role inheritance not modeled |

---

## Section 5 — Performance Improvements

### 5.1 Missing Critical Indexes

```sql
-- HIGH PRIORITY: Dashboard unread notification count (called on every page load)
CREATE INDEX idx_notifications_unread_count
  ON notifications (tenant_id, user_id)
  WHERE is_read = false AND expires_at IS NULL OR expires_at > now();

-- HIGH PRIORITY: Lead pipeline view (Kanban board)
CREATE INDEX idx_leads_pipeline_kanban
  ON leads (tenant_id, pipeline_id, stage_id, status)
  WHERE deleted_at IS NULL;

-- HIGH PRIORITY: Task due date dashboard widget
CREATE INDEX idx_tasks_due_upcoming
  ON tasks (tenant_id, due_date ASC, status)
  WHERE deleted_at IS NULL AND status NOT IN ('DONE', 'CANCELLED');

-- HIGH PRIORITY: Business identifier search by PAN/GSTIN (most frequent lookup)
CREATE UNIQUE INDEX idx_business_identifiers_lookup
  ON business_identifiers (tenant_id, type, value)
  WHERE value IS NOT NULL;

-- HIGH PRIORITY: Audit log compliance reports
CREATE INDEX idx_audit_logs_resource_lookup
  ON audit_logs (tenant_id, resource_type, resource_id, created_at DESC);

-- MEDIUM: Active subscription lookup (tenant middleware hot path)
CREATE INDEX idx_subscriptions_active
  ON subscriptions (tenant_id, status)
  WHERE status IN ('ACTIVE', 'TRIAL');

-- MEDIUM: Refresh token lookup by hash (every API request)
CREATE UNIQUE INDEX idx_refresh_tokens_hash
  ON refresh_tokens (token_hash);

-- MEDIUM: Share token lookup (public link access)
CREATE INDEX idx_document_shares_token
  ON document_shares (share_token)
  WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now());

-- MEDIUM: Compliance due date dashboard
CREATE INDEX idx_compliance_due
  ON business_compliance_status (tenant_id, due_date ASC, status)
  WHERE status IN ('PENDING', 'IN_PROGRESS');

-- LOW: Permission resolution (cached, but cache miss hits this)
CREATE INDEX idx_role_permissions_lookup
  ON role_permissions (role_id);

CREATE INDEX idx_user_roles_lookup
  ON user_roles (tenant_id, user_id);
```

---

### 5.2 Materialized Views Required

```sql
-- MV-01: Per-tenant dashboard summary (rebuild every 5 minutes)
CREATE MATERIALIZED VIEW mv_tenant_dashboard_summary AS
SELECT
  t.id                          AS tenant_id,
  COUNT(DISTINCT c.id)          AS total_clients,
  COUNT(DISTINCT b.id)          AS total_businesses,
  COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'ACTIVE') AS active_users,
  COUNT(DISTINCT ta.id) FILTER (WHERE ta.status = 'TODO') AS pending_tasks,
  COUNT(DISTINCT ta.id) FILTER (WHERE ta.due_date < now() AND ta.status != 'DONE') AS overdue_tasks
FROM tenants t
LEFT JOIN clients c ON c.tenant_id = t.id AND c.deleted_at IS NULL
LEFT JOIN businesses b ON b.tenant_id = t.id AND b.deleted_at IS NULL
LEFT JOIN users u ON u.tenant_id = t.id AND u.deleted_at IS NULL
LEFT JOIN tasks ta ON ta.tenant_id = t.id AND ta.deleted_at IS NULL
GROUP BY t.id;

CREATE UNIQUE INDEX ON mv_tenant_dashboard_summary (tenant_id);

-- MV-02: Compliance calendar (rebuild daily)
CREATE MATERIALIZED VIEW mv_compliance_calendar AS
SELECT
  bcs.tenant_id,
  bcs.business_id,
  b.name AS business_name,
  bcs.compliance_type,
  bcs.period_start,
  bcs.period_end,
  bcs.due_date,
  bcs.status,
  bcs.due_date - CURRENT_DATE AS days_until_due
FROM business_compliance_status bcs
JOIN businesses b ON b.id = bcs.business_id
WHERE bcs.status IN ('PENDING', 'IN_PROGRESS')
  AND bcs.due_date >= CURRENT_DATE - INTERVAL '7 days';

CREATE INDEX ON mv_compliance_calendar (tenant_id, due_date);
```

---

### 5.3 Generated Columns for Search Performance

```sql
-- Generated column for full name search on contacts (avoids function index)
ALTER TABLE contacts
  ADD COLUMN full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED;

CREATE INDEX idx_contacts_fullname_trgm ON contacts
  USING GIN (full_name gin_trgm_ops);

-- Generated column for tenant + email combined hash (fast unique check)
ALTER TABLE users
  ADD COLUMN tenant_email_hash TEXT GENERATED ALWAYS AS
    (encode(digest(tenant_id::TEXT || '|' || lower(email), 'sha256'), 'hex')) STORED;

CREATE UNIQUE INDEX idx_users_tenant_email ON users (tenant_email_hash);
```

---

### 5.4 Audit Log Partitioning — Missing Partition Pruning Index

**Problem:** The design mentions monthly partitioning but doesn't address the need for a `parent_id` index on the parent table for Prisma to route queries to the correct partition.

```sql
-- Required for partition pruning to work with Prisma/UUID primary keys
CREATE INDEX idx_audit_logs_tenant_created
  ON audit_logs (tenant_id, created_at DESC)
  PARTITION BY RANGE (created_at);
```

---

## Section 6 — Security Improvements

### SEC-01 — Separate Application DB Roles (Missing Entirely)

**Problem:** The architecture uses a single DB user. All application operations (reads, writes, deletes) use the same credentials.

**Fix — Define role hierarchy:**
```sql
-- Read-only role (for reports, read replicas)
CREATE ROLE app_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_reader;

-- Write role (for API server)
CREATE ROLE app_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_writer;
REVOKE INSERT, UPDATE, DELETE ON audit_logs, login_history FROM app_writer;

-- Audit write role (INSERT only on audit tables)
CREATE ROLE audit_writer;
GRANT INSERT ON audit_logs, login_history, permission_change_logs TO audit_writer;

-- Admin role (for migrations only, never used by application)
CREATE ROLE app_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_admin;
```

### SEC-02 — No `Content-Security-Policy` for White Label Custom CSS

**Problem:** `tenant_branding.custom_css TEXT NULL` allows tenants to inject arbitrary CSS. In a SaaS multi-tenant web app, one tenant's malicious CSS could affect shared components if CSS is server-rendered.

**Fix:** Sanitize custom CSS server-side before storage. Allowlist safe CSS properties. Never inject tenant CSS into shared admin interfaces.

### SEC-03 — `document_shares.password_hash` Algorithm Unspecified

**Problem:** The password hash column is defined but the algorithm is not. If a developer uses MD5 or unsalted SHA-1, shared document passwords are insecure.

**Fix:** Enforce bcrypt (cost factor ≥ 12) or Argon2id for all password hashing, including document share passwords. Document this as an architecture standard.

### SEC-04 — No IP Allowlisting at Tenant Level

**Problem:** A CA firm may want to restrict login to their office IP range. There's no IP allowlist table.

**Fix — Add:**
```
tenant_ip_allowlists
  id          UUID    PK
  tenant_id   UUID    FK → tenants.id
  ip_cidr     CIDR    NOT NULL
  description TEXT    NULL
  is_active   BOOLEAN DEFAULT true
  created_by  UUID    FK → users.id
  created_at  TIMESTAMPTZ
```

---

## Section 7 — Final Recommendations

### R-01 — Define a `projects` Table to Group Tasks

CA firms work in engagements — "GST Filing for FY2024-25 for Sharma Ltd". Tasks belong to engagements. The current schema has no `projects` or `engagements` entity. All tasks are flat. At scale, a firm with 200 clients and 5 compliance tasks per client has 1,000 tasks with no grouping. Add:

```
projects (engagements)
  id, tenant_id, client_id, name, description
  type ENUM (AUDIT, TAX, COMPLIANCE, ADVISORY, OTHER)
  status, start_date, end_date
  budget_hours, manager_id, created_by, created_at, deleted_at
```

Tasks then FK to both `project_id` and `client_id`.

---

### R-02 — Define `master_admins` as Separate Table, Not a Role in `users`

The current design lists `master_admins` in the tenant management module but never clarifies whether master admins are rows in the `users` table with a special flag, or a separate table. This ambiguity will cause security bugs.

**Decision required:** Master admins should be a **completely separate table** with no `tenant_id`, no FK to the `users` table, and a completely separate authentication flow. They should never be visible in any tenant's user list.

---

### R-03 — Add `schema_version` Table for Zero-Downtime Migration Tracking

```
schema_versions
  id            UUID    PK
  version       TEXT    UNIQUE
  description   TEXT
  applied_at    TIMESTAMPTZ DEFAULT now()
  applied_by    TEXT    -- The service/tool that applied it
  execution_ms  INTEGER
  checksum      TEXT
```

This gives you Flyway/Liquibase-style migration tracking independent of Prisma's migration table, useful for multi-service environments.

---

### R-04 — Define Explicit `CASCADE` Rules for Each FK

The architecture uses phrases like "cascade soft-delete" and "Restrict" but never defines the actual `ON DELETE` behavior for each FK. Before Prisma schema generation, every FK needs an explicit decision:

| FK | ON DELETE Behavior |
|---|---|
| `users.tenant_id` | RESTRICT |
| `user_sessions.user_id` | CASCADE (hard delete sessions) |
| `refresh_tokens.user_id` | CASCADE |
| `task_assignments.task_id` | CASCADE |
| `task_comments.task_id` | CASCADE |
| `task_attachments.task_id` | CASCADE |
| `document_versions.document_id` | RESTRICT (protect version history) |
| `document_shares.document_id` | CASCADE |
| `role_permissions.role_id` | CASCADE |
| `user_roles.user_id` | CASCADE |
| `user_roles.role_id` | RESTRICT |
| `invoice_line_items.invoice_id` | RESTRICT |
| `payments.invoice_id` | RESTRICT |
| `notification_deliveries.notification_id` | CASCADE |
| `lead_activities.lead_id` | CASCADE |
| `lead_stage_history.lead_id` | CASCADE |

This table must be completed before Prisma schema generation.

---

### R-05 — Add `version` Column to Key Tables for Optimistic Locking

For high-contention tables (`documents`, `tasks`, `subscriptions`), add optimistic concurrency control:

```
version   INTEGER  DEFAULT 1  NOT NULL
```

Application checks: `WHERE id = ? AND version = ?` on UPDATE. If `0 rows affected`, a conflict occurred. Increment `version` on every UPDATE. This prevents lost updates in concurrent edit scenarios (e.g., two users editing the same task simultaneously).

---

## Pre-Prisma Generation Checklist

Before generating the Prisma schema, confirm the following are resolved:

| # | Item | Status |
|---|---|---|
| 1 | CRITICAL-01: RLS `SET LOCAL` enforcement strategy defined | ⬜ |
| 2 | CRITICAL-02: Polymorphic `clients.entity_id` replaced with typed FKs | ⬜ |
| 3 | CRITICAL-03: `task_links` / `document_links` converted to typed junction tables | ⬜ |
| 4 | CRITICAL-04: `document_versions.is_current` race condition resolved | ⬜ |
| 5 | CRITICAL-05: Audit log immutability trigger and DB role defined | ⬜ |
| 6 | CRITICAL-06: GST/tax fields added to invoices and line items | ⬜ |
| 7 | CRITICAL-07: `SET LOCAL` vs `SET SESSION` rule documented | ⬜ |
| 8 | CRITICAL-08: `user_sessions` fully defined with `expires_at` | ⬜ |
| 9 | CRITICAL-09: `business_compliance_status.period` replaced with typed dates | ⬜ |
| 10 | CRITICAL-10: Dead letter queue and digest table added to notifications | ⬜ |
| 11 | CRITICAL-11: `refresh_tokens` with family tracking fully defined | ⬜ |
| 12 | CRITICAL-12: Subscription status cached on `tenants` table | ⬜ |
| 13 | CRITICAL-13: Aadhaar encryption strategy (deterministic AES) documented | ⬜ |
| 14 | CRITICAL-14: `custom_field_values` typed value columns defined | ⬜ |
| 15 | MEDIUM-01 through MEDIUM-21: All medium issues reviewed and accepted/rejected | ⬜ |
| 16 | All FK `ON DELETE` rules explicitly defined | ⬜ |
| 17 | `projects/engagements` entity decision made | ⬜ |
| 18 | `master_admins` table separation decision confirmed | ⬜ |
| 19 | GST invoice fields reviewed against Indian GST law requirements | ⬜ |
| 20 | `business_contacts` vs `contact_business_roles` consolidation done | ⬜ |

---

> **Review Version:** 1.0
> **Reviewed Against Architecture Version:** 1.0
> **Verdict:** Revise and re-review CRITICAL items before Prisma schema generation.
> **Estimated Revision Effort:** 2–3 days for schema updates + 1 day for re-review.
