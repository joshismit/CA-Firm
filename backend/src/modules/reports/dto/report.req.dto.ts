import { z } from 'zod';
import { reportTypeParamSchema, reportFiltersQuerySchema, reportExportQuerySchema } from '../schemas/report.schema';

export type ReportType = z.infer<typeof reportTypeParamSchema>['type'];
export type ReportExportFormat = z.infer<typeof reportExportQuerySchema>['format'];

export type ReportTypeParamDto = z.infer<typeof reportTypeParamSchema>;
export type ReportFiltersQueryDto = z.infer<typeof reportFiltersQuerySchema>;
export type ReportExportQueryDto = z.infer<typeof reportExportQuerySchema>;
