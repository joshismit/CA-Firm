import { z } from 'zod';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Branding Validation Schemas (PRD §4.3 — white-label)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `updateTenantBrandingSchema` covers every text/color field on
 * `TenantBranding` except the four image slots (`logoStorageKey`/
 * `logoDarkStorageKey`/`faviconStorageKey`/`loginBgStorageKey`) — those are
 * set through the separate multipart upload endpoint
 * (`uploadBrandingAssetSchema`, matching `modules/documents`' upload
 * pattern), never through this JSON body.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Enter a valid hex color');

export const updateTenantBrandingSchema = z.object({
  firmName: z.string().trim().min(1).max(255).optional(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  backgroundColor: hexColor.optional(),
  emailHeaderColor: hexColor.optional(),
  fontFamily: z.string().trim().min(1).max(100).optional(),
  customCss: z.string().trim().max(10_000).optional(),
  emailFooterText: z.string().trim().max(2_000).optional(),
  footerText: z.string().trim().max(500).optional(),
  supportEmail: z.string().trim().email('Must be a valid email').max(255).optional(),
  supportPhone: z.string().trim().max(30).optional(),
});

/** Which `TenantBranding` image column a branding asset upload targets. */
export const BRANDING_ASSET_SLOTS = ['logo', 'logoDark', 'favicon', 'loginBg'] as const;
export type BrandingAssetSlot = (typeof BRANDING_ASSET_SLOTS)[number];

export const uploadBrandingAssetSchema = z.object({
  slot: z.enum(BRANDING_ASSET_SLOTS),
});

/**
 * The public branding-resolution endpoint takes the hostname as an explicit
 * query param — set by the frontend from `window.location.hostname` — rather
 * than reading the request's own `Host` header. A CDN/reverse-proxy fronting
 * a white-label custom domain commonly forwards to a shared API origin
 * (e.g. `api.cafirmapp.com`), so the literal `Host` header the API sees is
 * frequently NOT the address bar's domain the branding should be resolved
 * for.
 */
export const resolvePublicBrandingQuerySchema = z.object({
  host: z.string().trim().min(1).max(253),
});
