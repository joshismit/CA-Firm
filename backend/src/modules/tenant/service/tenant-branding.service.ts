import { Request } from 'express';
import { TenantBranding } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { BadRequestError } from '@shared/errors';
import { UPLOAD } from '@shared/constants';
import { CryptoUtils } from '@shared/utils';
import { S3StorageService } from '@storage/s3-storage.service';
import { TenantBrandingRepository } from '../repository/tenant-branding.repository';
import { BrandingMapper, ResolvedAssetUrls } from '../mapper/branding.mapper';
import { UpdateTenantBrandingDto } from '../dto/branding.req.dto';
import { TenantBrandingResponseDto } from '../dto/branding.res.dto';
import { BrandingAssetSlot } from '../schemas/branding.schema';

const ASSET_COLUMN: Record<BrandingAssetSlot, 'logoStorageKey' | 'logoDarkStorageKey' | 'faviconStorageKey' | 'loginBgStorageKey'> = {
  logo: 'logoStorageKey',
  logoDark: 'logoDarkStorageKey',
  favicon: 'faviconStorageKey',
  loginBg: 'loginBgStorageKey',
};

/** Strips path separators and unsafe characters before the name becomes part of an S3 key. Same rule as `modules/documents/service/document.service.ts`'s own helper. */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Branding Service (PRD §4.3 — white-label)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for the tenant's own `TenantBranding` singleton row. No HTTP
 * concerns — the controller passes plain values in and gets domain results
 * back, exactly like every other module's service.
 *
 * `getBranding()`/`updateBranding()` never 404 for a tenant that hasn't
 * configured branding yet — the row simply doesn't exist, which is a normal,
 * expected state (most tenants will never touch this), not a missing
 * resource. `upsert()` on the repository creates the row on first write.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TenantBrandingService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: TenantBrandingRepository = new TenantBrandingRepository(prisma),
    private readonly storageService: S3StorageService = new S3StorageService(),
  ) {
    super(req);
  }

  async getBranding(): Promise<TenantBrandingResponseDto> {
    const branding = await this.repository.findByTenantId(this.tenantId as string);
    if (!branding) {
      return this.emptyBrandingResponse();
    }

    const assetUrls = await this.resolveAssetUrls(branding);
    return BrandingMapper.toResponseDto(branding, assetUrls);
  }

  async updateBranding(dto: UpdateTenantBrandingDto): Promise<TenantBrandingResponseDto> {
    this.logger.info('Updating tenant branding');

    await this.repository.upsert(this.tenantId as string, dto);
    return this.getBranding();
  }

  async uploadAsset(slot: BrandingAssetSlot, file: Express.Multer.File | undefined): Promise<TenantBrandingResponseDto> {
    if (!file) {
      throw new BadRequestError('A file is required.');
    }
    if (!(UPLOAD.ALLOWED_AVATAR_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestError(`Unsupported file type: ${file.mimetype}`);
    }
    if (file.size > UPLOAD.MAX_AVATAR_SIZE_BYTES) {
      throw new BadRequestError('File exceeds the maximum upload size.');
    }

    const tenantId = this.tenantId as string;
    const storageKey = `tenants/${tenantId}/branding/${slot}-${CryptoUtils.generateRandomToken(16)}-${sanitizeFileName(file.originalname)}`;

    this.logger.info({ slot, sizeBytes: file.size }, 'Uploading branding asset');

    await this.storageService.upload(storageKey, file.buffer, file.mimetype);
    await this.repository.upsert(tenantId, { [ASSET_COLUMN[slot]]: storageKey });

    return this.getBranding();
  }

  private async resolveAssetUrls(branding: TenantBranding): Promise<ResolvedAssetUrls> {
    const [logoUrl, logoDarkUrl, faviconUrl, loginBgUrl] = await Promise.all([
      branding.logoStorageKey ? this.storageService.getDownloadUrl(branding.logoStorageKey) : Promise.resolve(null),
      branding.logoDarkStorageKey ? this.storageService.getDownloadUrl(branding.logoDarkStorageKey) : Promise.resolve(null),
      branding.faviconStorageKey ? this.storageService.getDownloadUrl(branding.faviconStorageKey) : Promise.resolve(null),
      branding.loginBgStorageKey ? this.storageService.getDownloadUrl(branding.loginBgStorageKey) : Promise.resolve(null),
    ]);
    return { logoUrl, logoDarkUrl, faviconUrl, loginBgUrl };
  }

  private emptyBrandingResponse(): TenantBrandingResponseDto {
    return {
      firmName: null,
      logoUrl: null,
      logoDarkUrl: null,
      faviconUrl: null,
      loginBgUrl: null,
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
      backgroundColor: null,
      emailHeaderColor: null,
      fontFamily: null,
      customCss: null,
      emailFooterText: null,
      footerText: null,
      supportEmail: null,
      supportPhone: null,
      updatedAt: null,
    };
  }
}
