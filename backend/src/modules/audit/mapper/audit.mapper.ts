import { AuditLog } from '@prisma/client';
import { AuditLogResponseDto } from '../dto/audit.res.dto';

/**
 * Entity ⇄ DTO mapper for `AuditLog`. Controllers/services must always
 * return data through this mapper — never serialize a raw Prisma row.
 */
export class AuditMapper {
  static toResponseDto(auditLog: AuditLog): AuditLogResponseDto {
    return {
      id: auditLog.id,
      eventType: auditLog.eventType,
      actorId: auditLog.actorId,
      actorName: auditLog.actorName,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      description: auditLog.description,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      oldValue: auditLog.oldValue,
      newValue: auditLog.newValue,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt.toISOString(),
    };
  }

  static toResponseDtoList(auditLogs: AuditLog[]): AuditLogResponseDto[] {
    return auditLogs.map((auditLog) => this.toResponseDto(auditLog));
  }
}
