import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '@shared/errors';

/**
 * Permission Middleware Factory.
 * Checks if the authenticated user has the required permission(s).
 *
 * Usage (single permission):
 * router.get('/clients', authMiddleware, requirePermission('clients:read'), controller.list)
 *
 * Usage (multiple — user must have ALL):
 * router.delete('/clients/:id', authMiddleware, requirePermission('clients:delete', 'clients:manage'), controller.delete)
 *
 * Usage (at least one):
 * router.get('/reports', authMiddleware, requireAnyPermission('reports:read', 'reports:export'), controller.list)
 */
export function requirePermission(...permissions: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const userPermissions = req.user.permissions || [];
    const hasAll = permissions.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      throw new ForbiddenError(
        `Required permissions: ${permissions.join(', ')}`,
      );
    }

    next();
  };
}

/**
 * User must have at least ONE of the specified permissions.
 */
export function requireAnyPermission(...permissions: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const userPermissions = req.user.permissions || [];
    const hasAny = permissions.some((p) => userPermissions.includes(p));

    if (!hasAny) {
      throw new ForbiddenError(
        `Required at least one of: ${permissions.join(', ')}`,
      );
    }

    next();
  };
}

/**
 * Role-based guard (simpler than permission-based).
 * Use sparingly — prefer permission-based RBAC.
 */
export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient role');
    }

    next();
  };
}
