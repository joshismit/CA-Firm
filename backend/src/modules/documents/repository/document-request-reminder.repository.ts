import { PrismaClient, Prisma, DocumentRequestReminder, ReminderCadenceType } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

export interface RecordDocumentRequestReminderInput {
  documentRequestId: string;
  userId: string;
  type: ReminderCadenceType;
  bucket: string;
}

/** Data access for the `DocumentRequestReminder` idempotency ledger — mirrors `InvoiceReminderRepository` exactly. */
export class DocumentRequestReminderRepository extends BaseRepository<Prisma.DocumentRequestReminderDelegate, DocumentRequestReminder> {
  constructor(prisma: PrismaClient) {
    super(prisma.documentRequestReminder, prisma);
  }

  async findExisting(
    documentRequestIds: string[],
    type: ReminderCadenceType,
    bucket: string,
    options: RepositoryOptions = {},
  ): Promise<Pick<DocumentRequestReminder, 'documentRequestId' | 'userId'>[]> {
    if (documentRequestIds.length === 0) return [];

    return this.prisma.documentRequestReminder.findMany({
      where: this.applyFilters({ documentRequestId: { in: documentRequestIds }, type, bucket }, { ...options, ignoreSoftDelete: true }),
      select: { documentRequestId: true, userId: true },
    });
  }

  async record(input: RecordDocumentRequestReminderInput, options: RepositoryOptions): Promise<DocumentRequestReminder> {
    return this.create(
      { documentRequestId: input.documentRequestId, userId: input.userId, type: input.type, bucket: input.bucket },
      { ...options, ignoreSoftDelete: true },
    );
  }
}
