import { prisma } from '@config/database';
import { S3StorageService } from '@storage/s3-storage.service';
import { TenantDomainRepository } from '../repository/tenant-domain.repository';
import { TenantBrandingRepository } from '../repository/tenant-branding.repository';
import { BrandingMapper } from '../mapper/branding.mapper';
import { PublicBrandingResponseDto } from '../dto/branding.res.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Public Branding Service (PRD §4.3 white-label — the actual "serving" half)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Not a `BaseService` — there is no authenticated tenant context here; this
 * IS what resolves which tenant a request belongs to, from a hostname alone,
 * before any login has happened. Backs the one public, unauthenticated
 * endpoint in this module (`GET /public/white-label`) that the frontend's
 * `AuthLayout` calls on every page load so a tenant's custom domain/subdomain
 * shows their own logo/colors even on the login screen.
 *
 * No hostname match resolves to an all-null `PublicBrandingResponseDto`
 * (the platform's own default branding applies) rather than a 404 — visiting
 * the plain platform URL with no white-label configured is the overwhelmingly
 * common case, not an error.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class PublicBrandingService {
  constructor(
    private readonly domainRepository: TenantDomainRepository = new TenantDomainRepository(prisma),
    private readonly brandingRepository: TenantBrandingRepository = new TenantBrandingRepository(prisma),
    private readonly storageService: S3StorageService = new S3StorageService(),
  ) {}

  async resolveByHostname(hostname: string): Promise<PublicBrandingResponseDto> {
    const domain = await this.domainRepository.findByHostname(hostname);
    if (!domain) {
      return BrandingMapper.toPublicResponseDto(null, { logoUrl: null, faviconUrl: null });
    }

    const branding = await this.brandingRepository.findByTenantId(domain.tenantId);

    const [logoUrl, faviconUrl] = await Promise.all([
      branding?.logoStorageKey ? this.storageService.getDownloadUrl(branding.logoStorageKey) : Promise.resolve(null),
      branding?.faviconStorageKey ? this.storageService.getDownloadUrl(branding.faviconStorageKey) : Promise.resolve(null),
    ]);

    return BrandingMapper.toPublicResponseDto(branding, { logoUrl, faviconUrl });
  }
}
