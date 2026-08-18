import { PrismaClient, Prisma, PlatformInvoice, PlatformInvoiceStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';
import { PlatformInvoiceWithPlan } from '../mapper/billing.mapper';

const withPlan = { plan: true } as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Platform Invoice Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for `PlatformInvoice` (the tenant's payment records to the ERP
 * vendor). Inherits tenant scoping and standard CRUD/pagination from
 * `BaseRepository` — no soft delete on this model (financial records are
 * never deleted). `findByRazorpayOrderId` is the one deliberately unscoped
 * method: at checkout-verification/webhook time the caller doesn't know
 * which tenant an incoming Razorpay order belongs to yet — that's precisely
 * what this lookup resolves, via `PlatformInvoice.razorpayOrderId`'s own
 * unique constraint (not tenant + id).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class PlatformInvoiceRepository extends BaseRepository<Prisma.PlatformInvoiceDelegate, PlatformInvoice> {
  constructor(prisma: PrismaClient) {
    super(prisma.platformInvoice, prisma);
  }

  async findByRazorpayOrderId(razorpayOrderId: string): Promise<PlatformInvoiceWithPlan | null> {
    return this.prisma.platformInvoice.findUnique({
      where: { razorpayOrderId },
      include: withPlan,
    });
  }

  async paginateWithPlan(
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: PlatformInvoiceWithPlan[]; meta: PaginationMeta }> {
    // `PlatformInvoice` has no `deletedAt` column (financial records are never soft-deleted) —
    // `ignoreSoftDelete: true` skips BaseRepository's default `deletedAt: null` filter, which
    // would otherwise reference a column that doesn't exist on this model.
    const result = await this.paginate(pagination, {}, { ...options, ignoreSoftDelete: true }, withPlan);
    return { data: result.data as PlatformInvoiceWithPlan[], meta: result.meta };
  }

  async markPaid(
    id: string,
    data: { razorpayPaymentId: string; razorpaySignature: string; periodStart: Date; periodEnd: Date },
  ): Promise<PlatformInvoice> {
    return this.prisma.platformInvoice.update({
      where: { id },
      data: {
        status: PlatformInvoiceStatus.PAID,
        razorpayPaymentId: data.razorpayPaymentId,
        razorpaySignature: data.razorpaySignature,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        paidAt: new Date(),
      },
    });
  }
}
