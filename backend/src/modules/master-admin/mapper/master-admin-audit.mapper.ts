import { AuditLog } from '@prisma/client';
// Concrete path, not the `@modules/audit` barrel — that module deliberately doesn't export
// `AuditMapper` (internal implementation detail, see `modules/audit/index.ts`'s header comment).
// Mirrors this module's own precedent of reaching into another module's internals via a concrete
// path (see `tenant.service.ts`'s header comment for why).
import { AuditMapper } from '@modules/audit/mapper/audit.mapper';
import { MasterAdminAuditLogResponseDto } from '../dto/master-admin.res.dto';

/**
 * Entity ⇄ DTO mapper for the master-admin (cross-tenant) audit log view.
 * Delegates every tenant-agnostic field to `AuditMapper.toResponseDto()` —
 * the exact same mapping the tenant-scoped `AuditLogController` uses — and
 * only adds `tenantId`/`tenantName` on top, so the two views can never drift
 * apart on how a raw `AuditLog` row is serialised.
 */
export class MasterAdminAuditMapper {
  static toResponseDto(auditLog: AuditLog, tenantName: string | null): MasterAdminAuditLogResponseDto {
    return {
      ...AuditMapper.toResponseDto(auditLog),
      tenantId: auditLog.tenantId,
      tenantName,
    };
  }

  static toResponseDtoList(auditLogs: AuditLog[], tenantNamesById: Map<string, string>): MasterAdminAuditLogResponseDto[] {
    return auditLogs.map((auditLog) => this.toResponseDto(auditLog, tenantNamesById.get(auditLog.tenantId) ?? null));
  }
}
