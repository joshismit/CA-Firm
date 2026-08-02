import { DashboardPreference } from '@prisma/client';
import { DashboardPreferenceResponseDto } from '../dto/dashboard-preference.res.dto';
import { WidgetPreferenceDto } from '../dto/dashboard-preference.req.dto';

/**
 * Entity ⇄ DTO mapper for `DashboardPreference`. Controllers/services must
 * always return data through this mapper — never serialize a raw Prisma row.
 */
export class DashboardPreferenceMapper {
  static toResponseDto(preference: DashboardPreference | null): DashboardPreferenceResponseDto {
    if (!preference) {
      return { widgets: [], updatedAt: null };
    }

    return {
      widgets: preference.widgets as unknown as WidgetPreferenceDto[],
      updatedAt: preference.updatedAt.toISOString(),
    };
  }
}
