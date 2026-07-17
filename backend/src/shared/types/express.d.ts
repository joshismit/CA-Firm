import { Request } from 'express';

/**
 * Augments the Express Request type with application-specific properties.
 * These are attached by middlewares (auth, tenant, correlation-id).
 */
declare global {
  namespace Express {
    interface Request {
      // Attached by correlationIdMiddleware
      correlationId: string;

      // Attached by authMiddleware
      user?: {
        id: string;
        email: string;
        role: string;
        tenantId: string;
        permissions: string[];
      };

      // Attached by tenantMiddleware
      tenant?: {
        id: string;
        slug: string;
        name: string;
        plan: string;
        isActive: boolean;
      };
    }
  }
}

export {};
