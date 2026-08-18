// business module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting), the service (so other modules can compose with it in-process),
// permission constants, and DTO types. `BusinessRepository`,
// `BusinessTypeRepository`, `BusinessController`, and `BusinessMapper` are
// deliberately NOT exported — they're internal implementation details; other
// modules should go through `BusinessService`, never around it. Mirrors
// `modules/projects/index.ts`.

export { default as businessRoutes } from './routes/business.routes';
export { BusinessService } from './service/business.service';
export { BUSINESS_PERMISSIONS } from './constants/business.permissions';
export type { BusinessResponseDto, BusinessTypeResponseDto, BusinessAssignmentResponseDto } from './dto/business.res.dto';
export type {
  CreateBusinessDto,
  UpdateBusinessDto,
  ListBusinessesQueryDto,
  AssignBusinessDto,
} from './dto/business.req.dto';
