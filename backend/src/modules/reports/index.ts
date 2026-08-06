// reports module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting), DTO types, and — as of PRD §10.5/§10.7 — `ReportService`, so
// `DashboardAggregationService` (`modules/dashboard`) can compose the
// "Performance" widget through it, the same kind of cross-module dashboard
// composition `modules/tasks`/`modules/client-billing` already export
// `TaskService`/`InvoiceService` for. `ReportsRepository` and
// `ReportController` remain deliberately NOT exported — no other module
// needs to compose with those directly. Mirrors `modules/contacts/index.ts`.

export { default as reportRoutes } from './routes/report.routes';
export { ReportService } from './service/report.service';
export { REPORT_PERMISSIONS } from './constants/report.permissions';
export type { ReportResultResponseDto } from './dto/report.res.dto';
export type { ReportType, ReportExportFormat } from './dto/report.req.dto';
export type { ReportFilters } from './repository/reports.repository';
