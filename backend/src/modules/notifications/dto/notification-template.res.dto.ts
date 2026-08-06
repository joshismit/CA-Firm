import { NotificationChannel } from '@prisma/client';

export interface NotificationTemplateResponseDto {
  id: string;
  key: string;
  channel: NotificationChannel;
  name: string;
  description: string | null;
  subjectTemplate: string | null;
  bodyTemplateText: string;
  bodyTemplateHtml: string | null;
  isActive: boolean;
  isSystemDefault: boolean;
  /** True when this row is the tenant's own override of a global default with the same `(key, channel)` — computed by `NotificationTemplateService.listCatalog()`, not a DB column. */
  isOverridden: boolean;
  createdAt: string;
  updatedAt: string;
}
