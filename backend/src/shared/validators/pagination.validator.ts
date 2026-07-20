import { z } from 'zod';
import { PAGINATION } from '@shared/constants';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Pagination Validator
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Validates standard list query parameters (`page`, `limit`, `sortBy`, `sortOrder`).
 *   Provides sane defaults if parameters are omitted.
 *
 * USAGE:
 *   // In a route handler or validation middleware
 *   const query = paginationSchema.parse(req.query);
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, 'Page must be at least 1')
    .default(PAGINATION.DEFAULT_PAGE),

  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION.MIN_LIMIT, `Limit must be at least ${PAGINATION.MIN_LIMIT}`)
    .max(PAGINATION.MAX_LIMIT, `Limit cannot exceed ${PAGINATION.MAX_LIMIT}`)
    .default(PAGINATION.DEFAULT_LIMIT),

  sortBy: z
    .string()
    .min(1)
    .max(50)
    .default(PAGINATION.DEFAULT_SORT_BY),

  sortOrder: z
    .enum(['asc', 'desc'])
    .default(PAGINATION.DEFAULT_SORT_ORDER),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

/**
 * Creates a schema for standard multi-tenant search.
 * Extends the pagination schema with an optional search string.
 */
export const searchPaginationSchema = paginationSchema.extend({
  search: z.string().max(100, 'Search term is too long').optional(),
});

export type SearchPaginationQuery = z.infer<typeof searchPaginationSchema>;
