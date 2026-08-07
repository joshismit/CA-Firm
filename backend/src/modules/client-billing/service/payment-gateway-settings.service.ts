import { Request } from 'express';
import { AuditEventType, PaymentGatewayProviderType } from '@prisma/client';
import { prisma } from '@config/database';
import { paymentGatewayEncryptionConfig } from '@config/payment-gateway-encryption';
import { BaseService } from '@shared/base';
import { ForbiddenError, ServiceUnavailableError } from '@shared/errors';
import { MESSAGES } from '@shared/constants';
import { ErrorCode } from '@shared/enums';
import { CryptoUtils } from '@shared/utils';
import { AuditLogRecorder } from '@modules/audit';
import { PaymentGatewaySettingsRepository } from '../repository/payment-gateway-settings.repository';
import { PaymentGatewaySettingsMapper } from '../mapper/payment-gateway-settings.mapper';
import { UpdatePaymentGatewaySettingsDto } from '../dto/payment-gateway-settings.req.dto';
import {
  PaymentGatewaySettingsResponseDto,
  PaymentGatewayCapabilitiesResponseDto,
  PaymentGatewayHealthResponseDto,
} from '../dto/payment-gateway-settings.res.dto';
import { resolvePaymentGatewayProvider } from '../providers';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Payment Gateway Settings Service (PRD §12 — firm payment settings)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One-row-per-tenant, same shape as `TenantStorageSettingsService`: a
 * settings singleton read/updated through this one service, always
 * returning a default value even before the first write. `keySecret`/
 * `webhookSecret` are encrypted with `CryptoUtils.encryptSecret()` before
 * ever reaching the repository — the raw plaintext is held only for the
 * duration of this method call and is never logged or persisted.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class PaymentGatewaySettingsService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: PaymentGatewaySettingsRepository = new PaymentGatewaySettingsRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {
    super(req);
  }

  async getSettings(): Promise<PaymentGatewaySettingsResponseDto> {
    const settings = await this.repository.findByTenantId(this.requireTenantId());
    return settings ? PaymentGatewaySettingsMapper.toResponseDto(settings) : PaymentGatewaySettingsMapper.toDefaultResponseDto();
  }

  async updateSettings(dto: UpdatePaymentGatewaySettingsDto): Promise<PaymentGatewaySettingsResponseDto> {
    const tenantId = this.requireTenantId();
    const existing = await this.repository.findByTenantId(tenantId);

    const provider = dto.provider ?? existing?.provider ?? PaymentGatewayProviderType.DISABLED;
    const enabled = dto.enabled ?? existing?.enabled ?? false;

    if ((dto.keySecret || dto.webhookSecret) && !paymentGatewayEncryptionConfig.isConfigured) {
      throw new ServiceUnavailableError(
        'Payment gateway credential storage is not configured on this server yet',
        ErrorCode.DEPENDENCY_UNAVAILABLE,
      );
    }

    const encryptionKey = paymentGatewayEncryptionConfig.key as string;
    const encryptedKeySecret = dto.keySecret
      ? CryptoUtils.encryptSecret(dto.keySecret, encryptionKey)
      : (existing?.encryptedKeySecret ?? null);
    const encryptedWebhookSecret = dto.webhookSecret
      ? CryptoUtils.encryptSecret(dto.webhookSecret, encryptionKey)
      : (existing?.encryptedWebhookSecret ?? null);
    const keyId = dto.keyId ?? existing?.keyId ?? null;
    const isTestMode = dto.isTestMode ?? existing?.isTestMode ?? true;

    // Recomputed server-side, never accepted from the request body — "Active" reflects
    // whether the selected provider actually has what it needs, not just user intent.
    const isActive =
      enabled &&
      resolvePaymentGatewayProvider({
        id: '',
        tenantId,
        enabled,
        provider,
        keyId,
        encryptedKeySecret,
        encryptedWebhookSecret,
        isTestMode,
        isActive: false,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).isConfigured;

    this.logger.info({ provider, enabled }, 'Updating firm payment gateway settings');

    const settings = await this.repository.upsert(
      tenantId,
      { enabled, provider, keyId, encryptedKeySecret, encryptedWebhookSecret, isTestMode, isActive, updatedBy: this.userId ?? null },
      this.userId ?? null,
    );

    if (this.userId) {
      await this.auditLogRecorder.record({
        tenantId,
        actorId: this.userId,
        eventType: AuditEventType.SETTINGS_UPDATE,
        description: `Updated client payment gateway settings (provider: ${provider}, enabled: ${enabled}${dto.keySecret ? ', key secret rotated' : ''}${dto.webhookSecret ? ', webhook secret rotated' : ''})`,
        targetType: 'FirmPaymentGatewaySettings',
        targetId: settings.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    return PaymentGatewaySettingsMapper.toResponseDto(settings);
  }

  async getCapabilities(): Promise<PaymentGatewayCapabilitiesResponseDto> {
    const settings = await this.repository.findByTenantId(this.requireTenantId());
    const provider = resolvePaymentGatewayProvider(settings);
    return { provider: provider.type, ...provider.getCapabilities() };
  }

  async getHealth(): Promise<PaymentGatewayHealthResponseDto> {
    const settings = await this.repository.findByTenantId(this.requireTenantId());
    const provider = resolvePaymentGatewayProvider(settings);
    const health = await provider.healthCheck();
    return { provider: provider.type, ...health };
  }

  private requireTenantId(): string {
    if (!this.tenantId) throw new ForbiddenError(MESSAGES.FORBIDDEN);
    return this.tenantId;
  }
}
