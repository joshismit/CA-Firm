import { MasterAdmin, Tenant } from '@prisma/client';
import {
  MasterAdminResponseDto,
  TenantDetailResponseDto,
  TenantResponseDto,
  TenantUsageDto,
} from '../dto/master-admin.res.dto';

/** A `Tenant` row with the cheap `_count.users` relation read included — see `TenantRepository.search()`. */
export type TenantWithUserCount = Tenant & { _count: { users: number } };

export class TenantMapper {
  static toResponseDto(tenant: TenantWithUserCount): TenantResponseDto {
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      subscriptionStatus: tenant.subscriptionStatus,
      planCode: tenant.planCode,
      userCount: tenant._count.users,
      createdAt: tenant.createdAt.toISOString(),
    };
  }

  static toResponseDtoList(tenants: TenantWithUserCount[]): TenantResponseDto[] {
    return tenants.map((tenant) => this.toResponseDto(tenant));
  }

  static toDetailResponseDto(tenant: Tenant, usage: TenantUsageDto): TenantDetailResponseDto {
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      subscriptionStatus: tenant.subscriptionStatus,
      planCode: tenant.planCode,
      subscriptionExpiresAt: tenant.subscriptionExpiresAt ? tenant.subscriptionExpiresAt.toISOString() : null,
      maxUsers: tenant.maxUsers,
      maxClients: tenant.maxClients,
      maxStorageGb: tenant.maxStorageGb,
      maxDocuments: tenant.maxDocuments,
      usage,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    };
  }

  static toAdminResponseDto(admin: MasterAdmin): MasterAdminResponseDto {
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
    };
  }
}
