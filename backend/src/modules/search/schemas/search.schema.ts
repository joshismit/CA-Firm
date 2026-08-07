import { z } from 'zod';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Search Validation Schema
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PRD §13.1 — `q` is required (an empty search would otherwise mean "match
 * everything" across five tables at once, which is exactly the unindexed
 * full-table scan the PRD's "Performance" section rules out). `limit`
 * defaults to 10/category (PRD's stated default) and is capped at 25 — the
 * same "small, capped, cross-entity result set" reasoning as every
 * `findForGlobalSearch()` finder this schema's output feeds.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'q is required'),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});
