import { z } from 'zod';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Firm Storage Settings Validation Schema (PRD §7.4 — Upload Rules)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Only `defaultBusinessStorageQuotaMb` is firm-admin-settable here —
 * `maxUploadSizeMb` is plan-derived (`Tenant.maxUploadSizeMb`, set by a
 * master admin via `PATCH /master-admin/tenants/:id/limits`) and appears in
 * `GET /settings/storage` read-only. `null` reverts to the global
 * `UPLOAD.DEFAULT_BUSINESS_STORAGE_QUOTA_BYTES` default (500 MB).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const updateStorageSettingsSchema = z.object({
  defaultBusinessStorageQuotaMb: z.coerce.number().int().min(1, 'Storage quota must be at least 1 MB').nullable().optional(),
});
