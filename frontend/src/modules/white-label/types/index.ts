// TypeScript types for white-label branding + custom domain (PRD §4.3).
// Field-for-field match with the backend's response DTOs
// (backend/src/modules/tenant/dto/branding.res.dto.ts, domain.res.dto.ts).

export interface TenantBranding {
  firmName: string | null
  logoUrl: string | null
  logoDarkUrl: string | null
  faviconUrl: string | null
  loginBgUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  backgroundColor: string | null
  emailHeaderColor: string | null
  fontFamily: string | null
  customCss: string | null
  emailFooterText: string | null
  footerText: string | null
  supportEmail: string | null
  supportPhone: string | null
  updatedAt: string | null
}

export interface UpdateTenantBrandingPayload {
  firmName?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  backgroundColor?: string
  emailHeaderColor?: string
  fontFamily?: string
  customCss?: string
  emailFooterText?: string
  footerText?: string
  supportEmail?: string
  supportPhone?: string
}

export type BrandingAssetSlot = 'logo' | 'logoDark' | 'favicon' | 'loginBg'

export type DomainSslStatus = 'PENDING' | 'PROVISIONED' | 'FAILED' | 'EXPIRING'

export interface DomainVerificationInstructions {
  recordType: 'TXT'
  recordName: string
  recordValue: string
}

export interface TenantDomain {
  domain: string
  subdomain: string | null
  isVerified: boolean
  verifiedAt: string | null
  sslStatus: DomainSslStatus
  verification: DomainVerificationInstructions | null
  createdAt: string
}

export interface CreateTenantDomainPayload {
  subdomain?: string
  customDomain?: string
}

/** The small, public subset served by `GET /public/white-label` — what a pre-login page needs. */
export interface PublicBranding {
  firmName: string | null
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string | null
  accentColor: string | null
}
