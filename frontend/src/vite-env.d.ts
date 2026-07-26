/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  /** Local dev only - lets the stubbed login sign a JWT the real backend will accept. Never set in production. */
  readonly VITE_DEV_JWT_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
