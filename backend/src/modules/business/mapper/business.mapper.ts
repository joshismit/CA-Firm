import { Business, BusinessType } from '@prisma/client';
import { StorageSummary } from '@modules/documents';
import { BusinessResponseDto, BusinessTypeResponseDto } from '../dto/business.res.dto';

/**
 * Entity ⇄ DTO mapper for `Business`/`BusinessType`. Controllers/services must
 * always return data through this mapper — never serialize a raw Prisma row
 * in a response.
 */
export class BusinessMapper {
  /**
   * `usage` (PRD §7.4) is only ever passed by `getBusinessById()` — the list endpoint omits it.
   * `StorageSummary.quotaBytes`/`remainingBytes` are typed nullable (a tenant summary can be
   * unlimited) but a *business* summary never actually resolves to `null` — see
   * `StorageQuotaService.getBusinessStorageSummary()`'s default-fallback chain — so the `?? 0`
   * here is just type narrowing, never a real fallback in practice.
   */
  static toResponseDto(business: Business, usage?: StorageSummary): BusinessResponseDto {
    return {
      id: business.id,
      typeId: business.typeId,
      name: business.name,
      legalName: business.legalName,
      status: business.status,
      pan: business.pan,
      gstin: business.gstin,
      cin: business.cin,
      incorporationDate: business.incorporationDate ? business.incorporationDate.toISOString() : null,
      financialYearStart: business.financialYearStart,
      industry: business.industry,
      storageQuotaMb: business.storageQuotaMb,
      storageUsage: usage
        ? { usedBytes: usage.usedBytes, quotaBytes: usage.quotaBytes ?? 0, remainingBytes: usage.remainingBytes ?? 0 }
        : undefined,
      createdAt: business.createdAt.toISOString(),
      updatedAt: business.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(businesses: Business[]): BusinessResponseDto[] {
    return businesses.map((business) => this.toResponseDto(business));
  }

  static toTypeResponseDto(type: BusinessType): BusinessTypeResponseDto {
    return {
      id: type.id,
      code: type.code,
      name: type.name,
      description: type.description,
      isActive: type.isActive,
    };
  }

  static toTypeResponseDtoList(types: BusinessType[]): BusinessTypeResponseDto[] {
    return types.map((type) => this.toTypeResponseDto(type));
  }
}
