import { TenantBranding } from '@prisma/client';
import { TenantBrandingResponseDto, PublicBrandingResponseDto } from '../dto/branding.res.dto';

export interface ResolvedAssetUrls {
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  loginBgUrl: string | null;
}

/**
 * Entity ⇄ DTO mapper for `TenantBranding`. Image URLs are pre-resolved by
 * the caller (presigning is an async S3 call the mapper itself shouldn't
 * perform) and passed in alongside the entity — mirrors
 * `modules/documents/mapper/document.mapper.ts` not owning presigning either.
 */
export class BrandingMapper {
  static toResponseDto(branding: TenantBranding, assetUrls: ResolvedAssetUrls): TenantBrandingResponseDto {
    return {
      firmName: branding.firmName,
      logoUrl: assetUrls.logoUrl,
      logoDarkUrl: assetUrls.logoDarkUrl,
      faviconUrl: assetUrls.faviconUrl,
      loginBgUrl: assetUrls.loginBgUrl,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      backgroundColor: branding.backgroundColor,
      emailHeaderColor: branding.emailHeaderColor,
      fontFamily: branding.fontFamily,
      customCss: branding.customCss,
      emailFooterText: branding.emailFooterText,
      footerText: branding.footerText,
      supportEmail: branding.supportEmail,
      supportPhone: branding.supportPhone,
      updatedAt: branding.updatedAt.toISOString(),
    };
  }

  static toPublicResponseDto(
    branding: TenantBranding | null,
    assetUrls: Pick<ResolvedAssetUrls, 'logoUrl' | 'faviconUrl'>,
  ): PublicBrandingResponseDto {
    return {
      firmName: branding?.firmName ?? null,
      logoUrl: assetUrls.logoUrl,
      faviconUrl: assetUrls.faviconUrl,
      primaryColor: branding?.primaryColor ?? null,
      accentColor: branding?.accentColor ?? null,
    };
  }
}
