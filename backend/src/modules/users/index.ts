// users module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting), the service (so other modules can compose with it in-process),
// permission constants, and DTO types. `UserRepository`, `UserInvitationRepository`,
// `UserController`, and `UserMapper` are deliberately NOT exported — they're
// internal implementation details; other modules should go through
// `UserService`, never around it. Mirrors `modules/contacts/index.ts`.

export { default as userRoutes } from './routes/user.routes';
export { UserService } from './service/user.service';
export { USER_PERMISSIONS } from './constants/user.permissions';
export type { UserResponseDto, UserInvitationResponseDto, UserRoleResponseDto } from './dto/user.res.dto';
export type { InviteUserDto, UpdateUserDto, ListUsersQueryDto } from './dto/user.req.dto';
