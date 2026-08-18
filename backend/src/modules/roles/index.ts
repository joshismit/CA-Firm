// roles module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting), the service (so other modules can compose with it in-process),
// permission constants, and DTO types. `RoleRepository`, `RoleController`,
// and `RoleMapper` are deliberately NOT exported — they're internal
// implementation details; other modules should go through `RoleService`,
// never around it. Mirrors `modules/contacts/index.ts`.

export { default as roleRoutes } from './routes/role.routes';
export { RoleService } from './service/role.service';
export { ROLE_PERMISSIONS } from './constants/role.permissions';
export type { RoleResponseDto } from './dto/role.res.dto';
export type { CreateRoleDto, UpdateRoleDto, ListRolesQueryDto, AssignRoleDto } from './dto/role.req.dto';
