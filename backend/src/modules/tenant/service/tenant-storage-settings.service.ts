import { Request } from 'express';
import { AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { AuditLogRecorder } from '@modules/audit';
import { StorageQuotaService } from '@modules/documents';
import { TenantStorageSettingsRepository } from '../repository/tenant-storage-settings.repository';
import { UpdateStorageSettingsDto } from '../dto/storage-settings.req.dto';
import { StorageSettingsResponseDto } from '../dto/storage-settings.res.dto';

const BYTES_PER_MB = 1024 * 1024;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Storage Settings Service (PRD §7.4 — Upload Rules, Firm Settings → Storage)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Fills a real gap — no `TenantSettings` service/controller existed at all
 * before this (only `TenantBranding`/`TenantDomain` did). Mirrors
 * `modules/tenant/service/tenant-branding.service.ts`'s shape: a tenant-
 * self-service singleton row, read/updated through this one service.
 *
 * `maxUploadSizeMb` is deliberately read-only here — it's plan-derived
 * (`Tenant.maxUploadSizeMb`), changed only by a master admin via
 * `PATCH /master-admin/tenants/:id/limits`, never by the firm itself. Reuses
 * `StorageQuotaService.getEffectiveMaxUploadBytes()` — the exact same
 * resolution `DocumentService` enforces uploads against — rather than
 * re-deriving the effective value a second way.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TenantStorageSettingsService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: TenantStorageSettingsRepository = new TenantStorageSettingsRepository(prisma),
    private readonly storageQuotaService: StorageQuotaService = new StorageQuotaService(),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {
    super(req);
  }

  async getStorageSettings(): Promise<StorageSettingsResponseDto> {
    const tenantId = this.tenantId as string;

    const [maxUploadBytes, settings] = await Promise.all([
      this.storageQuotaService.getEffectiveMaxUploadBytes(tenantId),
      this.repository.findByTenantId(tenantId),
    ]);

    return {
      maxUploadSizeMb: Math.round(maxUploadBytes / BYTES_PER_MB),
      defaultBusinessStorageQuotaMb: settings?.defaultBusinessStorageQuotaMb ?? null,
    };
  }

  async updateStorageSettings(dto: UpdateStorageSettingsDto): Promise<StorageSettingsResponseDto> {
    const tenantId = this.tenantId as string;
    const before = await this.repository.findByTenantId(tenantId);

    this.logger.info('Updating firm storage settings');

    if (dto.defaultBusinessStorageQuotaMb !== undefined) {
      await this.repository.upsertDefaultBusinessQuota(tenantId, dto.defaultBusinessStorageQuotaMb);

      // PRD §7.4 — "changing upload limits must generate audit logs" extends to the firm's own
      // default business quota setting, not just master-admin-controlled limits.
      if (this.userId && dto.defaultBusinessStorageQuotaMb !== (before?.defaultBusinessStorageQuotaMb ?? null)) {
        await this.auditLogRecorder.record({
          tenantId,
          actorId: this.userId,
          eventType: AuditEventType.SETTINGS_UPDATE,
          description: `Changed default business storage quota from ${before?.defaultBusinessStorageQuotaMb ?? 'default'} MB to ${dto.defaultBusinessStorageQuotaMb ?? 'default'} MB`,
          targetType: 'TenantSettings',
          targetId: tenantId,
          ipAddress: this.req.ip ?? null,
        });
      }
    }

    return this.getStorageSettings();
  }
}
