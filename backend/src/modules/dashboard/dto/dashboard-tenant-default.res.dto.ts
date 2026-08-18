import { UserRole } from '@shared/enums';
import { WidgetPreferenceDto } from './dashboard-preference.req.dto';

export interface DashboardTenantDefaultResponseDto {
  role: UserRole;
  widgets: WidgetPreferenceDto[];
  updatedAt: string | null;
}
