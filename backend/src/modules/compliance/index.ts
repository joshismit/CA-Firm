// compliance module — public exports
//
// Only the module's actual public surface is exported here: the route
// factory (for mounting, once per `ComplianceCategory`) and DTO types.
// `ComplianceFilingRepository`, `ComplianceFilingController`, and
// `ComplianceFilingMapper` are deliberately NOT exported — internal
// implementation details. Mirrors `modules/contacts/index.ts`.

export { createComplianceFilingRoutes } from './routes/compliance-filing.routes';
export { ComplianceFilingService } from './service/compliance-filing.service';
export type { ComplianceFilingResponseDto } from './dto/compliance-filing.res.dto';
export type {
  CreateComplianceFilingDto,
  UpdateComplianceFilingDto,
  ListComplianceFilingsQueryDto,
} from './dto/compliance-filing.req.dto';
