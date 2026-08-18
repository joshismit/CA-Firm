/**
 * Response DTO for the tenant's own branding settings (`GET/PATCH /settings/branding`).
 * Image fields are presigned, time-limited GET URLs (via `S3StorageService.getDownloadUrl`)
 * — never raw storage keys — mirroring `modules/documents`' own response shape.
 */
export interface TenantBrandingResponseDto {
  firmName: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  loginBgUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  emailHeaderColor: string | null;
  fontFamily: string | null;
  customCss: string | null;
  emailFooterText: string | null;
  footerText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  /** `null` when this tenant has never configured branding — the row doesn't exist yet, not an error (see `TenantBrandingService.getBranding()`). */
  updatedAt: string | null;
}

/**
 * Response DTO for the PUBLIC, unauthenticated branding resolution endpoint
 * (`GET /public/white-label`). Deliberately a much smaller subset than
 * `TenantBrandingResponseDto` — only what a pre-login page needs to render
 * (logo, name, primary color), never `customCss`/support contact/etc., which
 * are internal-settings-page concerns, not public payload.
 */
export interface PublicBrandingResponseDto {
  firmName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
}
