import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AnyZodObject, ZodError, z } from 'zod';
import { ValidationError } from '@shared/errors';

/**
 * Validation Schemas for a route
 */
interface ValidationSchemas {
  body?: AnyZodObject;
  params?: AnyZodObject;
  query?: AnyZodObject;
}

/**
 * Validation Middleware Factory.
 * Creates a middleware that validates request body, params, and query
 * against Zod schemas. Returns 422 with field-level error details on failure.
 *
 * Usage:
 * router.post('/login', validate({ body: loginSchema }), controller.login)
 *
 * On success: req.body / req.params / req.query are replaced with
 * the parsed (type-safe) Zod output.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        }));
        next(new ValidationError('Validation failed', details));
      } else {
        next(err);
      }
    }
  };
}

/**
 * Common pagination query schema — reuse on all list endpoints.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
});
