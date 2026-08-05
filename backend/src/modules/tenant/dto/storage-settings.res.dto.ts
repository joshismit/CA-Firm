/**
 * PRD §7.4 — Firm Settings → Storage. `maxUploadSizeMb` is read-only (plan-derived,
 * `Tenant.maxUploadSizeMb`, master-admin overridable) — always resolved to a concrete number,
 * never `null`, since `StorageQuotaService.getEffectiveMaxUploadBytes()` already falls back to
 * the global default when the tenant has no plan override. `defaultBusinessStorageQuotaMb` is
 * firm-admin editable; `null` means "using the global default."
 */
export interface StorageSettingsResponseDto {
  maxUploadSizeMb: number;
  defaultBusinessStorageQuotaMb: number | null;
}
