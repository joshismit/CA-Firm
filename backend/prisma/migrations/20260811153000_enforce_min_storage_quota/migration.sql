-- Data backfill: enforce the "every plan/tenant has at least 1 GB total storage" rule.
--
-- No schema change — `plans.max_storage_gb` and `tenants.max_storage_gb` already exist
-- (added in 20260731072856_add_platform_billing) and already use GB as the unit, with
-- NULL meaning "unlimited" (which trivially satisfies a >= 1 GB minimum). This migration
-- only raises rows that were set to 0 (below the new floor) up to 1 GB.
--
-- Safe & idempotent:
--   - Never touches NULL (unlimited) rows.
--   - Only ever raises a value, never lowers one (WHERE ... < 1 is only ever true for 0,
--     since the column has always been non-negative in practice), so re-running this
--     migration, or running it against data that already satisfies the rule, is a no-op.
--   - Does not touch `businesses.storage_quota_mb` or
--     `tenant_settings.default_business_storage_quota_mb` — those are intentionally
--     sub-allocations of a tenant's total quota among its businesses, not the plan-level
--     total storage rule this migration enforces.

UPDATE "plans"
SET "max_storage_gb" = 1
WHERE "max_storage_gb" IS NOT NULL AND "max_storage_gb" < 1;

UPDATE "tenants"
SET "max_storage_gb" = 1
WHERE "max_storage_gb" IS NOT NULL AND "max_storage_gb" < 1;
