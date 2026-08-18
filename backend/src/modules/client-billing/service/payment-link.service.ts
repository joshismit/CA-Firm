import { Request } from 'express';
import { Prisma, InvoiceStatus, PaymentGatewayLinkStatus, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError, ServiceUnavailableError } from '@shared/errors';
import { ErrorCode } from '@shared/enums';
import { AuditLogRecorder } from '@modules/audit';
import { PaymentGatewayLinkRepository } from '../repository/payment-gateway-link.repository';
import { PaymentGatewaySettingsRepository } from '../repository/payment-gateway-settings.repository';
import { InvoiceRepository } from '../repository/invoice.repository';
import { PaymentLinkMapper } from '../mapper/payment-link.mapper';
import { CreatePaymentLinkDto } from '../dto/payment-link.req.dto';
import { PaymentLinkResponseDto } from '../dto/payment-link.res.dto';
import { resolvePaymentGatewayProvider } from '../providers';

const DEFAULT_EXPIRY_HOURS = 168; // 7 days — matches BillingReminderService's own reminder window.

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Payment Link Service (PRD §12 — "invoices... generate payment links using
 * the configured provider")
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The one place `InvoiceRepository` (this module's own, not a cross-module
 * reach) and a resolved `PaymentGatewayProvider` meet: validates the invoice
 * belongs to this tenant and isn't already settled, resolves this firm's
 * configured provider, asks it to `initializePayment()`, and persists the
 * result as a `PaymentGatewayLink` row. Never calls Razorpay (or any vendor
 * SDK) directly — everything goes through the provider interface.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class PaymentLinkService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: PaymentGatewayLinkRepository = new PaymentGatewayLinkRepository(prisma),
    private readonly invoiceRepository: InvoiceRepository = new InvoiceRepository(prisma),
    private readonly settingsRepository: PaymentGatewaySettingsRepository = new PaymentGatewaySettingsRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {
    super(req);
  }

  async listByInvoice(invoiceId: string): Promise<PaymentLinkResponseDto[]> {
    const tenantId = this.tenantId as string;
    const invoice = await this.invoiceRepository.findById(invoiceId, { tenantId });
    this.validateExists(invoice, 'Invoice');

    const links = await this.repository.listByInvoice(invoiceId, { tenantId });
    return PaymentLinkMapper.toResponseDtoList(links);
  }

  async generatePaymentLink(dto: CreatePaymentLinkDto): Promise<PaymentLinkResponseDto> {
    const tenantId = this.tenantId as string;

    const invoice = await this.invoiceRepository.findById(dto.invoiceId, { tenantId });
    this.validateExists(invoice, 'Invoice');

    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOID) {
      throw new ConflictError(`Cannot generate a payment link for a ${invoice.status.toLowerCase()} invoice`, ErrorCode.CONFLICT);
    }

    const settings = await this.settingsRepository.findByTenantId(tenantId);
    const gatewayProvider = resolvePaymentGatewayProvider(settings);

    if (!settings?.enabled || !gatewayProvider.isConfigured) {
      throw new ServiceUnavailableError('No payment gateway is configured for this firm yet', ErrorCode.DEPENDENCY_UNAVAILABLE);
    }

    const amountInPaise = Math.round((invoice.amount.toNumber() + invoice.tax.toNumber()) * 100);
    const expiresAt = new Date(Date.now() + (dto.expiresInHours ?? DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000);

    this.logger.info({ invoiceId: invoice.id, provider: settings.provider }, 'Generating client payment link');

    const result = await gatewayProvider.initializePayment({
      amountInPaise,
      currency: 'INR',
      referenceId: invoice.invoiceNumber,
      description: `Invoice ${invoice.invoiceNumber}`,
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerContact: dto.customerContact,
      expiresAt,
    });

    const link = await this.repository.create(
      {
        invoiceId: invoice.id,
        provider: settings.provider,
        providerPaymentId: result.providerPaymentId,
        url: result.paymentUrl,
        amountInPaise,
        currency: 'INR',
        status: PaymentGatewayLinkStatus.CREATED,
        expiresAt: result.expiresAt ?? expiresAt,
        providerMetadata: result.raw as Prisma.InputJsonValue,
        createdBy: this.userId ?? null,
      },
      { tenantId },
    );

    if (this.userId) {
      await this.auditLogRecorder.record({
        tenantId,
        actorId: this.userId,
        eventType: AuditEventType.PAYMENT_ACTION,
        description: `Generated a ${settings.provider} payment link for invoice "${invoice.invoiceNumber}"`,
        targetType: 'PaymentGatewayLink',
        targetId: link.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    return PaymentLinkMapper.toResponseDto(link);
  }
}
