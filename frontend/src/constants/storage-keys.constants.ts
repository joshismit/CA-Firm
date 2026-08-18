// Canonical localStorage/sessionStorage key names to avoid string-literal drift across the app.

export const STORAGE_KEYS = {
  AUTH: 'ca-erp-auth',
  /** Mirrors the key contexts/ThemeContext.tsx reads/writes directly - not wired there yet since
   * Theme is out of scope for this pass, kept here so the full key catalog stays accurate. */
  THEME: 'ca-erp-theme',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
