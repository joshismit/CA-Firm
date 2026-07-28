// crm module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting), the service (so other modules can compose with it in-process),
// permission constants, and DTO types. `LeadRepository`, `LeadStageRepository`,
// `LeadConversionRepository`, `ClientRepository`, `LeadController`, and
// `LeadMapper` are deliberately NOT exported — they're internal
// implementation details; other modules should go through `LeadService`,
// never around it. Mirrors `modules/business/index.ts`.

export { default as crmRoutes } from './routes/lead.routes';
export { LeadService } from './service/lead.service';
export { CRM_PERMISSIONS } from './constants/lead.permissions';
export type { LeadResponseDto, LeadStageResponseDto } from './dto/lead.res.dto';
export type { CreateLeadDto, UpdateLeadDto, ListLeadsQueryDto, ConvertLeadDto } from './dto/lead.req.dto';
