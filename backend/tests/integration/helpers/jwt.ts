import jwt from 'jsonwebtoken';
import { jwtConfig } from '@config/jwt';
import { UserRole } from '@shared/enums';

export interface TestTokenOptions {
  userId: string;
  /** Omit for a MASTER_ADMIN token — a master admin isn't tenant-scoped (see `RequestUser.tenantId`'s comment). */
  tenantId?: string;
  email?: string;
  role?: UserRole;
  permissions?: string[];
  /** Negative values produce an already-expired token, for auth-middleware tests. */
  expiresInSeconds?: number;
}

/**
 * Signs a real access token with the app's actual JWT secret
 * (`jwtConfig.access.secret`, from `@config/jwt`) so `authMiddleware` verifies
 * it exactly as it would a production token.
 */
export function signAccessToken(opts: TestTokenOptions): string {
  const {
    userId,
    tenantId,
    email = 'integration.test@example.test',
    role = UserRole.TENANT_ADMIN,
    permissions = [],
    expiresInSeconds = 15 * 60,
  } = opts;

  return jwt.sign({ sub: userId, email, role, tenantId, permissions }, jwtConfig.access.secret, {
    expiresIn: expiresInSeconds,
  });
}
