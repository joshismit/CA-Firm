import { z } from 'zod';
import { auditLogIdParamSchema, listAuditLogsQuerySchema } from '../schemas/audit.schema';

export type AuditLogIdParamDto = z.infer<typeof auditLogIdParamSchema>;
export type ListAuditLogsQueryDto = z.infer<typeof listAuditLogsQuerySchema>;
