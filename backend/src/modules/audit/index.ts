// audit module — public exports
//
// The router (for mounting), `AuditLogRecorder` (the one write path other
// modules use to record events), and `AuditTimelineReader` (the one read
// path other modules use to render a per-entity timeline, PRD §8.11) are the
// only public surface. `AuditLogRepository`, `AuditLogController`,
// `AuditMapper`, and the request-scoped `AuditLogService` (the generic
// `/audit-logs` list endpoint) are deliberately NOT exported — no other
// module needs to compose with those directly. Mirrors `modules/notifications/index.ts`.

export { default as auditRoutes } from './routes/audit-log.routes';
export { AuditLogRecorder } from './service/audit-log.recorder';
export type { RecordAuditEventParams } from './service/audit-log.recorder';
export { AuditTimelineReader } from './service/audit-timeline.reader';
export type { AuditLogResponseDto } from './dto/audit.res.dto';
export type { ListAuditLogsQueryDto } from './dto/audit.req.dto';
