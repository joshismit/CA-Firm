// auth module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting) and the service (so other modules can compose with it
// in-process). Mirrors `modules/crm/index.ts`.

export { default as authRoutes } from './routes/auth.routes';
export { AuthService } from './service/auth.service';
export type { LoginResponseDto, RefreshResponseDto, MeResponseDto, SessionResponseDto } from './dto/auth.res.dto';
export type { LoginDto, ChangePasswordDto } from './dto/auth.req.dto';
