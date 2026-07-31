import { z } from 'zod';
import { AuditEventType } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Audit Log Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * No create/update body schemas — audit entries are system-generated (see
 * `service/audit-log.recorder.ts`'s header comment); this module only ever
 * reads. `search` (inherited from `searchPaginationSchema`) matches against
 * `description`. `from`/`to` are plain date bounds on `createdAt`, matching
 * `modules/reports/schemas/report.schema.ts`'s exact convention (`lte: to`,
 * no end-of-day adjustment).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

export const auditLogIdParamSchema = z.object({ id: uuid });

export const listAuditLogsQuerySchema = searchPaginationSchema.extend({
  eventType: z.nativeEnum(AuditEventType).optional(),
  actorId: uuid.optional(),
  targetType: z.string().max(50).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
