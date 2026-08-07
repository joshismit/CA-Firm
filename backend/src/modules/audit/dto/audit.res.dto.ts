import { AuditEventType, Prisma } from '@prisma/client';

/**
 * Response DTO — field-for-field match with the frontend's already-built
 * `AuditLogEntry` type (frontend/src/modules/audit/types/index.ts).
 * Deliberately omits `tenantId` — internal scoping field, never exposed to
 * the client.
 */
export interface AuditLogResponseDto {
  id: string;
  eventType: AuditEventType;
  actorId: string;
  actorName: string;
  targetType: string | null;
  targetId: string | null;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  oldValue: Prisma.JsonValue | null;
  newValue: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
}
