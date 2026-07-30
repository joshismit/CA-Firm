// reports module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting) and DTO types. `ReportsRepository`, `ReportController`, and
// `ReportService` are deliberately NOT exported — no other module needs to
// compose with this one. Mirrors `modules/contacts/index.ts`.

export { default as reportRoutes } from './routes/report.routes';
export { REPORT_PERMISSIONS } from './constants/report.permissions';
export type { ReportResultResponseDto } from './dto/report.res.dto';
export type { ReportType, ReportExportFormat } from './dto/report.req.dto';
