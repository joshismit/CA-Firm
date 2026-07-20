import { Request, Response, NextFunction } from 'express';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Async Handler Wrapper
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Wraps asynchronous Express route handlers (controllers) to automatically
 *   catch rejected promises and pass them to the global error middleware.
 *
 * WHY:
 *   Express v4 does not automatically catch unhandled promise rejections inside
 *   route handlers. If an async function throws, the request will hang and
 *   eventually timeout, causing a poor client experience and missing logs.
 *   (Express v5 fixes this natively, but we are on v4).
 *
 * USAGE:
 *   router.post('/login', asyncHandler(AuthController.login));
 *
 *   // Inline example
 *   router.get('/me', asyncHandler(async (req, res) => {
 *      const user = await db.user.findUnique(...);
 *      if (!user) throw new NotFoundError('User');
 *      res.json(ApiResponseHelper.success(req, user));
 *   }));
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
