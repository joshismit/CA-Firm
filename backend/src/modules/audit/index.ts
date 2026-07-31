// audit module — public exports
//
// The router (for mounting) and `AuditLogRecorder` (for other modules to
// record events) are the only public surface. `AuditLogRepository`,
// `AuditLogController`, `AuditMapper`, and the read-only `AuditLogService`
// are deliberately NOT exported — no other module needs to compose with
// those. Mirrors `modules/notifications/index.ts`.

export { default as auditRoutes } from './routes/audit-log.routes';
export { AuditLogRecorder } from './service/audit-log.recorder';
export type { RecordAuditEventParams } from './service/audit-log.recorder';
export type { AuditLogResponseDto } from './dto/audit.res.dto';
export type { ListAuditLogsQueryDto } from './dto/audit.req.dto';
