import { DashboardPreference, DashboardTenantDefault } from '@prisma/client';
import { DashboardPreferenceResponseDto } from '../dto/dashboard-preference.res.dto';
import { WidgetPreferenceDto } from '../dto/dashboard-preference.req.dto';

/**
 * Entity ⇄ DTO mapper for `DashboardPreference`. Controllers/services must
 * always return data through this mapper — never serialize a raw Prisma row.
 */
export class DashboardPreferenceMapper {
  static toResponseDto(preference: DashboardPreference | null): DashboardPreferenceResponseDto {
    if (!preference) {
      return { widgets: [], updatedAt: null, source: 'registry', refreshIntervalSeconds: null };
    }

    return {
      widgets: preference.widgets as unknown as WidgetPreferenceDto[],
      updatedAt: preference.updatedAt.toISOString(),
      source: 'personal',
      refreshIntervalSeconds: preference.refreshIntervalSeconds,
    };
  }

  /** PRD §10.3 — a resolved tenant/role default standing in for a user who has never saved their own layout. */
  static fromTenantDefault(tenantDefault: DashboardTenantDefault): DashboardPreferenceResponseDto {
    return {
      widgets: tenantDefault.widgets as unknown as WidgetPreferenceDto[],
      updatedAt: tenantDefault.updatedAt.toISOString(),
      source: 'tenant-default',
      refreshIntervalSeconds: null,
    };
  }
}
