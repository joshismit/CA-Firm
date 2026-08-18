import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '@config/jwt';
import { UnauthorizedError } from '@shared/errors';
import { UserRole } from '@shared/enums';

/**
 * JWT payload shape — must match what we sign at login.
 */
export interface JwtPayload {
  sub: string;      // userId
  email: string;
  role: UserRole;
  /** Absent for MASTER_ADMIN — see `RequestUser.tenantId`'s comment (shared/types/express.d.ts). */
  tenantId?: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

/**
 * Auth Middleware.
 * Verifies the JWT access token from the Authorization header.
 * Attaches decoded user payload to req.user.
 *
 * Usage: router.get('/protected', authMiddleware, controller.handler)
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Access token is required');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, jwtConfig.access.secret) as JwtPayload;

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      permissions: payload.permissions ?? [],
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid access token');
    }
    throw new UnauthorizedError('Authentication failed');
  }
}

/**
 * Optional auth middleware — does not throw if no token, but attaches user if present.
 * Use for endpoints accessible by both authenticated and anonymous users.
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, jwtConfig.access.secret) as JwtPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      permissions: payload.permissions ?? [],
    };
  } catch {
    // Silently ignore — user remains undefined
  }

  next();
}
