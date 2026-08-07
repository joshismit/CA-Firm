import { Request } from 'express';
import { Prisma, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { AuditLogRecorder } from '@modules/audit';
import { DashboardPreferenceRepository } from '../repository/dashboard-preference.repository';
import { DashboardTenantDefaultRepository } from '../repository/dashboard-tenant-default.repository';
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
    private readonly tenantDefaultRepository: DashboardTenantDefaultRepository = new DashboardTenantDefaultRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {
    super(req);
  }

  /**
   * Fallback chain (PRD §10.3): the caller's own saved row, then their tenant's
   * configured default for their coarse role, then the empty/registry-default shape
   * this always returned before tenant defaults existed. A brand-new user with no
   * personal layout yet transparently inherits whatever their tenant admin configured
   * for their role — never a hardcoded "everything visible" default once one exists.
   */
  async getPreferences(): Promise<DashboardPreferenceResponseDto> {
    const preference = await this.repository.findByUserId(this.userId as string);
    if (preference) return DashboardPreferenceMapper.toResponseDto(preference);

    const role = this.req.user?.role;
    if (role) {
      const tenantDefault = await this.tenantDefaultRepository.findByTenantAndRole(this.tenantId as string, role);
      if (tenantDefault) return DashboardPreferenceMapper.fromTenantDefault(tenantDefault);
    }

    return DashboardPreferenceMapper.toResponseDto(null);
  }

  async updatePreferences(dto: UpdateDashboardPreferencesDto): Promise<DashboardPreferenceResponseDto> {
    this.logger.info({ widgetCount: dto.widgets.length }, 'Updating dashboard preferences');

    const preference = await this.repository.upsert(
      this.tenantId as string,
      this.userId as string,
      dto.widgets as unknown as Prisma.InputJsonValue,
      dto.refreshIntervalSeconds,
    );

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.DASHBOARD_PREFERENCES_CHANGED,
        description: 'Updated dashboard preferences',
        targetType: 'DashboardPreference',
        targetId: this.userId,
        ipAddress: this.req.ip ?? null,
        userAgent: (this.req.headers?.['user-agent'] as string | undefined) ?? null,
        newValue: { widgetCount: dto.widgets.length, refreshIntervalSeconds: dto.refreshIntervalSeconds ?? null },
      });
    }

    return DashboardPreferenceMapper.toResponseDto(preference);
  }

  /** PRD §10.4 "Restore Defaults" — deletes the caller's personal layout so `getPreferences()` falls back to the tenant/role default (or the registry default). */
  async resetPreferences(): Promise<DashboardPreferenceResponseDto> {
    await this.repository.deleteByUserId(this.userId as string);
    this.logger.info('Reset dashboard preferences to default');

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.DASHBOARD_LAYOUT_RESET,
        description: 'Reset dashboard layout to default',
        targetType: 'DashboardPreference',
        targetId: this.userId,
        ipAddress: this.req.ip ?? null,
        userAgent: (this.req.headers?.['user-agent'] as string | undefined) ?? null,
      });
    }

    return this.getPreferences();
  }
}
