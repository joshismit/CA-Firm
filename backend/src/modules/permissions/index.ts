// permissions module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting) and DTO types. `PermissionRepository`, `PermissionController`,
// `PermissionMapper`, and `PermissionService` are deliberately NOT exported
// — no other module needs to compose with this one (unlike `RoleService`,
// which this module itself consumes). Mirrors `modules/contacts/index.ts`.

export { default as permissionRoutes } from './routes/permission.routes';
export type { PermissionResponseDto, PermissionGroupResponseDto, PermissionMatrixEntryResponseDto } from './dto/permission.res.dto';
export type { UpdatePermissionMatrixDto } from './dto/permission.req.dto';
