import { PrismaClient, Prisma, PaymentGatewayLink } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

/**
 * Data access for `PaymentGatewayLink`. Inherits tenant scoping and standard
 * CRUD from `BaseRepository` for every normal read/write.
 */
export class PaymentGatewayLinkRepository extends BaseRepository<Prisma.PaymentGatewayLinkDelegate, PaymentGatewayLink> {
  constructor(prisma: PrismaClient) {
    super(prisma.paymentGatewayLink, prisma);
  }

  async listByInvoice(invoiceId: string, options: RepositoryOptions = {}): Promise<PaymentGatewayLink[]> {
    return this.findMany({ invoiceId }, options, undefined, { createdAt: 'desc' });
  }

  /**
   * `PaymentGatewayLink` has `deletedAt` but no `deletedBy` column — same
   * situation as `InvoiceRepository`/`PaymentRepository`. Not currently
   * reachable via any endpoint (no delete route exists for payment links
   * today), overridden defensively for the same reason those two are.
   */
  async delete(id: string, options: RepositoryOptions = {}): Promise<boolean> {
    const where = this.applyFilters({ id }, options);
    const client = this.getClient(options.tx);
    const result = (await client.updateMany({ where, data: { deletedAt: new Date() } })) as { count: number };
    return result.count > 0;
  }

  /**
   * The ONE lookup in this module allowed to bypass tenant scoping —
   * `providerPaymentId` is a provider-issued ID (Razorpay's `plink_...`),
   * `@unique` tenant-wide, never client-chosen, so it safely identifies a
   * single row without knowing the tenant up front. This is exactly the
   * problem `PaymentGatewayWebhookService` has: a webhook payload arrives
   * with no tenant context at all. Every write that follows this call
   * re-derives `tenantId` from the row it returns and scopes through that —
   * no cross-tenant data is ever read or written as a result.
   */
  async findByProviderPaymentId(providerPaymentId: string): Promise<PaymentGatewayLink | null> {
    return this.prisma.paymentGatewayLink.findUnique({ where: { providerPaymentId } });
  }
}
