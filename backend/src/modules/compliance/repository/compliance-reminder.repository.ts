import { PrismaClient, Prisma, ComplianceReminder, ReminderCadenceType } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

export interface RecordComplianceReminderInput {
  complianceFilingId: string;
  userId: string;
  type: ReminderCadenceType;
  bucket: string;
}

/** Data access for the `ComplianceReminder` idempotency ledger — mirrors `InvoiceReminderRepository` exactly. */
export class ComplianceReminderRepository extends BaseRepository<Prisma.ComplianceReminderDelegate, ComplianceReminder> {
  constructor(prisma: PrismaClient) {
    super(prisma.complianceReminder, prisma);
  }

  async findExisting(
    complianceFilingIds: string[],
    type: ReminderCadenceType,
    bucket: string,
    options: RepositoryOptions = {},
  ): Promise<Pick<ComplianceReminder, 'complianceFilingId' | 'userId'>[]> {
    if (complianceFilingIds.length === 0) return [];

    return this.prisma.complianceReminder.findMany({
      where: this.applyFilters({ complianceFilingId: { in: complianceFilingIds }, type, bucket }, { ...options, ignoreSoftDelete: true }),
      select: { complianceFilingId: true, userId: true },
    });
  }

  async record(input: RecordComplianceReminderInput, options: RepositoryOptions): Promise<ComplianceReminder> {
    return this.create(
      { complianceFilingId: input.complianceFilingId, userId: input.userId, type: input.type, bucket: input.bucket },
      { ...options, ignoreSoftDelete: true },
    );
  }
}
