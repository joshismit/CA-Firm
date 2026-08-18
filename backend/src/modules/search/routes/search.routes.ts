import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validation.middleware';
import { SearchController } from '../controller/search.controller';
import { searchQuerySchema } from '../schemas/search.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Search Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `authMiddleware → tenantMiddleware → validate → controller` — deliberately
 * no `requirePermission()` gate here: per-category visibility is decided
 * inside `SearchService` (each category needs a *different* permission, and
 * a category the caller can't see should be silently omitted, not turn the
 * whole request into a 403). See `SearchService`'s header comment.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Global cross-entity search (PRD §13.1)
 *     description: >
 *       Searches Businesses, Contacts, Leads, Documents, and Tasks in
 *       parallel, tenant-scoped, excluding deleted records. Each category is
 *       silently omitted (empty array) unless the caller holds that
 *       resource's own `:read` permission — the same gate that resource's
 *       list page already uses. Documents are additionally scoped by the
 *       same `DocumentAccessScopeService` restriction the Documents list
 *       page itself enforces.
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: limit
 *         in: query
 *         description: Max results per category. Default 10.
 *         schema: { type: integer, minimum: 1, maximum: 25, default: 10 }
 *     responses:
 *       200: { description: Grouped search results. }
 *       401: { description: Missing or invalid access token. }
 *       422: { description: Missing or invalid query parameters. }
 */
router.get('/', authMiddleware, tenantMiddleware, validate({ query: searchQuerySchema }), SearchController.search);

export default router;
