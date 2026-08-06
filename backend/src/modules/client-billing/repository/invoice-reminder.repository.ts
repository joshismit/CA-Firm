import { PrismaClient, Prisma, InvoiceReminder, ReminderCadenceType } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

export interface RecordInvoiceReminderInput {
  invoiceId: string;
  userId: string;
  type: ReminderCadenceType;
  bucket: string;
}

/**
 * Data access for the `InvoiceReminder` idempotency ledger — mirrors
 * `modules/tasks/repository/task-reminder.repository.ts` exactly, with an
 * added `bucket` dimension (see that model's schema.prisma comment). No
 * `deletedAt` column — a sent-reminder record is permanent, so every method
 * passes `ignoreSoftDelete: true`.
 */
export class InvoiceReminderRepository extends BaseRepository<Prisma.InvoiceReminderDelegate, InvoiceReminder> {
  constructor(prisma: PrismaClient) {
    super(prisma.invoiceReminder, prisma);
  }

  async findExisting(
    invoiceIds: string[],
    type: ReminderCadenceType,
    bucket: string,
    options: RepositoryOptions = {},
  ): Promise<Pick<InvoiceReminder, 'invoiceId' | 'userId'>[]> {
    if (invoiceIds.length === 0) return [];

    return this.prisma.invoiceReminder.findMany({
      where: this.applyFilters({ invoiceId: { in: invoiceIds }, type, bucket }, { ...options, ignoreSoftDelete: true }),
      select: { invoiceId: true, userId: true },
    });
  }

  /** The row itself is the duplicate-send guard (`@@unique([invoiceId, userId, type, bucket])`) — a `P2002` here means a concurrent scan run already recorded it, not an error. */
  async record(input: RecordInvoiceReminderInput, options: RepositoryOptions): Promise<InvoiceReminder> {
    return this.create(
      { invoiceId: input.invoiceId, userId: input.userId, type: input.type, bucket: input.bucket },
      { ...options, ignoreSoftDelete: true },
    );
  }
}
