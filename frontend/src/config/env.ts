// src/config/env.ts
// Typed wrapper around import.meta.env - the only file allowed to read raw Vite env vars directly.

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1',
  appEnv: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  /** Local dev only - see modules/auth/api/index.ts. Undefined outside of a .env.development.local setup. */
  devJwtSecret: import.meta.env.VITE_DEV_JWT_SECRET,
} as const
