// compliance module — public exports
//
// Only the module's actual public surface is exported here: the route
// factory (for mounting, once per `ComplianceCategory`), `ComplianceFilingService`,
// DTO types, and — as of PRD §10.5/§10.6 — `ComplianceDashboardReader`, the
// cross-category counterpart `DashboardAggregationService` (`modules/dashboard`)
// composes with for the "Compliance Deadlines"/Calendar widgets (see that
// reader's own header comment for why `ComplianceFilingService` itself can't
// serve that query). `ComplianceFilingRepository`, `ComplianceFilingController`,
// and `ComplianceFilingMapper` remain deliberately NOT exported — internal
// implementation details. Mirrors `modules/contacts/index.ts`.

export { createComplianceFilingRoutes } from './routes/compliance-filing.routes';
export { ComplianceFilingService } from './service/compliance-filing.service';
export { ComplianceDashboardReader } from './service/compliance-dashboard.reader';
export { ComplianceReminderService } from './service/compliance-reminder.service';
export type { ComplianceReminderRunSummary } from './service/compliance-reminder.service';
export type { ComplianceDeadlineDto } from './service/compliance-dashboard.reader';
export type { ComplianceFilingResponseDto } from './dto/compliance-filing.res.dto';
export type {
  CreateComplianceFilingDto,
  UpdateComplianceFilingDto,
  ListComplianceFilingsQueryDto,
} from './dto/compliance-filing.req.dto';
