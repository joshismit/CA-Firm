import { DomainSslStatus } from '@prisma/client';

export interface TenantDomainResponseDto {
  domain: string;
  subdomain: string | null;
  /** `true` for platform subdomains (nothing to prove — see `TenantDomainService`'s header comment); real ownership status for custom domains. */
  isVerified: boolean;
  verifiedAt: string | null;
  sslStatus: DomainSslStatus;
  /** Only meaningful (non-null) while `isVerified` is false and this is a custom domain — the TXT record instructions the tenant still needs to act on. */
  verification: { recordType: 'TXT'; recordName: string; recordValue: string } | null;
  createdAt: string;
}
