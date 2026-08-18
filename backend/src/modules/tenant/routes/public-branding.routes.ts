import { Router } from 'express';
import { validate } from '@middlewares/validation.middleware';
import { PublicBrandingController } from '../controller/public-branding.controller';
import { resolvePublicBrandingQuerySchema } from '../schemas/branding.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Public Branding Routes (PRD §4.3 — the "serving" half of white-label)
 * ─────────────────────────────────────────────────────────────────────────────
 * Deliberately PUBLIC — no authMiddleware/tenantMiddleware. This is what lets
 * an unauthenticated visitor's login page show the right tenant's branding
 * before any login has happened. Mirrors `modules/compliance/routes/
 * compliance-filing.routes.ts`'s header comment on why some routes have no
 * gate at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * /public/white-label:
 *   get:
 *     tags: [White-Label]
 *     summary: Resolve the branding for a hostname
 *     description: No auth required. Returns all-null fields (platform default branding applies) when no tenant has claimed this hostname.
 *     parameters:
 *       - name: host
 *         in: query
 *         required: true
 *         schema: { type: string, example: firmname.cafirmapp.com }
 *     responses:
 *       200:
 *         description: Public branding for this hostname.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     firmName: { type: string, nullable: true }
 *                     logoUrl: { type: string, nullable: true }
 *                     faviconUrl: { type: string, nullable: true }
 *                     primaryColor: { type: string, nullable: true }
 *                     accentColor: { type: string, nullable: true }
 *       422: { description: Missing host query parameter. }
 */
router.get('/white-label', validate({ query: resolvePublicBrandingQuerySchema }), PublicBrandingController.resolve);

export default router;
