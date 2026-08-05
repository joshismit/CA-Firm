import { USER_PERMISSIONS } from '@modules/users/constants/user.permissions';
import { ROLE_PERMISSIONS } from './role.permissions';
import { DOCUMENT_PERMISSIONS } from '@modules/documents/constants/document.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Extended Role Catalog — Accountant / Auditor / HR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * These are ordinary tenant-scoped `Role` rows (same table as "Owner"/"Staff"
 * seeded by `prisma/seeds/dev-data.seed.ts`), not new RBAC concepts. This file
 * is the single source of truth for their names and permission sets so:
 *   - `dev-data.seed.ts` seeds real, consistent roles per demo tenant.
 *   - `DocumentAccessScopeService` (`modules/documents/service/
 *     document-access-scope.service.ts`) matches on `ACCOUNTANT_ROLE_NAME`/
 *     `AUDITOR_ROLE_NAME` (case-insensitive) instead of a hand-typed literal.
 *   - Tests assert against these lists directly instead of duplicating them.
 *
 * A tenant admin can also create their own custom "Accountant"/"Auditor"
 * role with any permission set they like — the scope service only cares
 * about the role *name*, not that it was seeded from here.
 *
 * Lives under `src/` (not `prisma/seeds/`) so both the seed script (relative
 * import, same as `prisma/seeds/permissions.seed.ts` already does) and the
 * Jest test suite (path-aliased import, `tsconfig.json`'s `rootDir` is
 * `./src`) can resolve it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ACCOUNTANT_ROLE_NAME = 'Accountant';
export const AUDITOR_ROLE_NAME = 'Auditor';
export const HR_ROLE_NAME = 'HR';

/** Full document lifecycle, further scoped to assigned Businesses at runtime by `DocumentAccessScopeService`. */
export const ACCOUNTANT_PERMISSION_CODES: string[] = [
  DOCUMENT_PERMISSIONS.CREATE,
  DOCUMENT_PERMISSIONS.READ,
  DOCUMENT_PERMISSIONS.UPDATE,
  DOCUMENT_PERMISSIONS.SHARE,
];

/** Read/share only, further scoped to the `AUDIT` category at runtime by `DocumentAccessScopeService`. */
export const AUDITOR_PERMISSION_CODES: string[] = [
  DOCUMENT_PERMISSIONS.READ,
  DOCUMENT_PERMISSIONS.SHARE,
];

/**
 * User-management only. Deliberately contains NO `documents:*` code — PRD
 * 6.2 requires HR to never see client documents. `requirePermission()`
 * already enforces this (no scoping logic needed), but keeping the set
 * explicit here means a future edit that accidentally adds a document
 * permission to HR is a one-line diff reviewers can catch, and tests assert
 * against this exact list rather than the live seeded DB state.
 */
export const HR_PERMISSION_CODES: string[] = [
  USER_PERMISSIONS.READ,
  USER_PERMISSIONS.MANAGE,
  ROLE_PERMISSIONS.READ,
];
