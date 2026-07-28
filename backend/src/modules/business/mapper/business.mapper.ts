import { Business, BusinessType } from '@prisma/client';
import { BusinessResponseDto, BusinessTypeResponseDto } from '../dto/business.res.dto';

/**
 * Entity ⇄ DTO mapper for `Business`/`BusinessType`. Controllers/services must
 * always return data through this mapper — never serialize a raw Prisma row
 * in a response.
 */
export class BusinessMapper {
  static toResponseDto(business: Business): BusinessResponseDto {
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
