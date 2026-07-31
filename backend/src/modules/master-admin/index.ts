// master-admin module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting) and DTO types. Repositories/services/controllers/mappers are
// deliberately NOT exported — internal implementation details. Mirrors
// `modules/business/index.ts`.

export { default as masterAdminRoutes } from './routes/master-admin.routes';
export type {
  MasterAdminLoginDto,
  ListTenantsQueryDto,
  UpdateTenantStatusDto,
  UpdateTenantLimitsDto,
} from './dto/master-admin.req.dto';
export type {
  MasterAdminResponseDto,
  MasterAdminLoginResponseDto,
  TenantResponseDto,
  TenantDetailResponseDto,
  TenantUsageDto,
} from './dto/master-admin.res.dto';
