import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { DashboardPreferenceRepository } from '../repository/dashboard-preference.repository';
import { DashboardPreferenceMapper } from '../mapper/dashboard-preference.mapper';
import { DashboardPreferenceResponseDto } from '../dto/dashboard-preference.res.dto';
import { UpdateDashboardPreferencesDto } from '../dto/dashboard-preference.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Preference Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for the caller's own `DashboardPreference` singleton row —
 * their personal widget show/hide + order layout for the home dashboard. No
 * HTTP concerns — the controller passes plain values in and gets domain
 * results back, exactly like every other module's service.
 *
 * `getPreferences()` never 404s for a user who has never customized their
 * dashboard — the row simply doesn't exist yet (every brand-new user is in
 * this state), which is normal, expected, first-run behavior, not a missing
 * resource; it returns `{ widgets: [] }` and the frontend's own widget
 * registry supplies the default layout. Mirrors
 * `modules/tenant/service/tenant-branding.service.ts`'s identical reasoning.
 *
 * Deliberately has no `requirePermission()` gate anywhere in this module's
 * routes (see `routes/dashboard-preference.routes.ts`'s header comment) —
 * this is a self-service personal layout, exactly like a user's own
 * notifications, matching `modules/notifications/service/notification
 * .service.ts`'s identical precedent.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DashboardPreferenceService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: DashboardPreferenceRepository = new DashboardPreferenceRepository(prisma),
  ) {
    super(req);
  }

  async getPreferences(): Promise<DashboardPreferenceResponseDto> {
    const preference = await this.repository.findByUserId(this.userId as string);
    return DashboardPreferenceMapper.toResponseDto(preference);
  }

  async updatePreferences(dto: UpdateDashboardPreferencesDto): Promise<DashboardPreferenceResponseDto> {
    this.logger.info({ widgetCount: dto.widgets.length }, 'Updating dashboard preferences');

    const preference = await this.repository.upsert(
      this.tenantId as string,
      this.userId as string,
      dto.widgets as unknown as Prisma.InputJsonValue,
    );
    return DashboardPreferenceMapper.toResponseDto(preference);
  }
}
