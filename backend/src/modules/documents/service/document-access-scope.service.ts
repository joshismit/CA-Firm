import { Prisma, DocumentCategory } from '@prisma/client';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
import { RequestUser } from '@shared/types';
import { ForbiddenError } from '@shared/errors';
import { RoleRepository } from '@modules/roles/repository/role.repository';
import { ACCOUNTANT_ROLE_NAME, AUDITOR_ROLE_NAME } from '@modules/roles/constants/extended-roles.constants';
import { BusinessAssignmentRepository } from '@modules/business/repository/business-assignment.repository';
import { ContactRepository } from '@modules/contacts/repository/contact.repository';
import { ContactRoleRepository } from '@modules/contacts/repository/contact-role.repository';
import { DocumentShareRepository } from '../repository/document-share.repository';

/** The subset of `Document` fields every scope check needs — never the full row. */
export interface ScopedDocument {
  id: string;
  businessId: string | null;
  contactId: string | null;
  category: DocumentCategory;
}

/**
 * The result of resolving a user's document access scope.
 *
 * - `businessIds` undefined  → no Business restriction.
 * - `businessIds` `[]`       → zero access (e.g. a Client with no linked Business, or an
 *                              Accountant not yet assigned to any Business) — deliberate, not a bug.
 * - `businessIds` non-empty  → allow-listed to these Businesses (plus `ownContactId`, plus `sharedDocumentIds`).
 * - `categories` undefined   → no category restriction.
 * - `sharedDocumentIds`      → explicit per-document grants (via `documents:share`) that bypass
 *                              the restrictions above, regardless of Business/category.
 */
export interface DocumentAccessScope {
  businessIds?: string[];
  ownContactId?: string;
  categories?: DocumentCategory[];
  sharedDocumentIds?: string[];
}

const UNRESTRICTED_COARSE_ROLES: UserRole[] = [UserRole.TENANT_ADMIN, UserRole.MASTER_ADMIN, UserRole.MANAGER];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Access Scope Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Centralizes the "which documents may this specific user touch" question —
 * the layer `requirePermission()` (a flat, JWT-baked permission check) can't
 * answer, since it has no notion of *which* Business or category a document
 * belongs to. `DocumentService` is the only caller; it resolves a scope once
 * per request and passes it through `assertAllowed`/`toWhereInput` at every
 * read/write call site, so the actual authorization rule lives in exactly
 * one place (PRD 6.2's "centralize authorization in reusable access-check
 * helpers" requirement).
 *
 * Resolved fresh from the DB on every call (not cached in the JWT): a newly
 * created/removed `BusinessAssignment` or role change must take effect
 * without the affected user needing to log out and back in.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DocumentAccessScopeService {
  constructor(
    private readonly roleRepository: RoleRepository = new RoleRepository(prisma),
    private readonly businessAssignmentRepository: BusinessAssignmentRepository = new BusinessAssignmentRepository(prisma),
    private readonly contactRepository: ContactRepository = new ContactRepository(prisma),
    private readonly contactRoleRepository: ContactRoleRepository = new ContactRoleRepository(prisma),
    private readonly documentShareRepository: DocumentShareRepository = new DocumentShareRepository(prisma),
  ) {}

  async resolve(user: RequestUser): Promise<DocumentAccessScope> {
    if (!user.tenantId || UNRESTRICTED_COARSE_ROLES.includes(user.role)) {
      return {};
    }

    let scope: DocumentAccessScope;

    if (user.role === UserRole.CLIENT) {
      scope = await this.resolveClientScope(user.id, user.tenantId);
    } else {
      scope = await this.resolveStaffScope(user.id, user.tenantId);
    }

    if (scope.businessIds || scope.categories) {
      scope.sharedDocumentIds = await this.documentShareRepository.findSharedDocumentIds(user.id, user.tenantId);
    }

    return scope;
  }

  private async resolveStaffScope(userId: string, tenantId: string): Promise<DocumentAccessScope> {
    const roleNames = (await this.roleRepository.findActiveRoleNamesForUser(userId, tenantId)).map((name) =>
      name.toLowerCase(),
    );

    const scope: DocumentAccessScope = {};

    if (roleNames.includes(AUDITOR_ROLE_NAME.toLowerCase())) {
      scope.categories = [DocumentCategory.AUDIT];
    }

    if (roleNames.includes(ACCOUNTANT_ROLE_NAME.toLowerCase())) {
      scope.businessIds = await this.businessAssignmentRepository.findBusinessIdsForUser(userId, tenantId);
    }

    return scope;
  }

  private async resolveClientScope(userId: string, tenantId: string): Promise<DocumentAccessScope> {
    const contact = await this.contactRepository.findFirst({ portalUserId: userId }, { tenantId });
    if (!contact) {
      return { businessIds: [] };
    }

    const roles = await this.contactRoleRepository.findByContact(contact.id, { tenantId });
    const businessIds = [...new Set(roles.map((role) => role.businessId))];

    return { businessIds, ownContactId: contact.id };
  }

  /** Throws `ForbiddenError` if `document` falls outside `scope`. */
  static assertAllowed(document: ScopedDocument, scope: DocumentAccessScope): void {
    if (scope.sharedDocumentIds?.includes(document.id)) {
      return;
    }

    if (scope.categories && !scope.categories.includes(document.category)) {
      throw new ForbiddenError('You do not have access to documents in this category.');
    }

    if (scope.businessIds) {
      const matchesBusiness = document.businessId != null && scope.businessIds.includes(document.businessId);
      const matchesOwnContact = scope.ownContactId != null && document.contactId === scope.ownContactId;
      if (!matchesBusiness && !matchesOwnContact) {
        throw new ForbiddenError('You do not have access to this document.');
      }
    }
  }

  /**
   * Folder variant of `assertAllowed()`. Folders (PRD 7.1 rule 3) have no
   * `contactId`/share concept — they're always Business-rooted — so this
   * intentionally only checks the `businessIds`/`categories` restrictions,
   * never the `ownContactId`/`sharedDocumentIds` bypasses `assertAllowed()`
   * also has. Throws `ForbiddenError` if `folder` falls outside `scope`.
   */
  static assertFolderAllowed(folder: { businessId: string; category: DocumentCategory }, scope: DocumentAccessScope): void {
    if (scope.categories && !scope.categories.includes(folder.category)) {
      throw new ForbiddenError('You do not have access to folders in this category.');
    }

    if (scope.businessIds && !scope.businessIds.includes(folder.businessId)) {
      throw new ForbiddenError('You do not have access to this Business.');
    }
  }

  /** Folder variant of `toWhereInput()` — see `assertFolderAllowed()` for why it's simpler. */
  static toFolderWhereInput(scope: DocumentAccessScope): Prisma.DocumentFolderWhereInput {
    const restrictions: Prisma.DocumentFolderWhereInput[] = [];

    if (scope.categories) {
      restrictions.push({ category: { in: scope.categories } });
    }

    if (scope.businessIds) {
      restrictions.push({ businessId: { in: scope.businessIds } });
    }

    return restrictions.length === 0 ? {} : { AND: restrictions };
  }

  /** Builds the extra `where` fragment `DocumentRepository.search()` ANDs onto its own filters. */
  static toWhereInput(scope: DocumentAccessScope): Prisma.DocumentWhereInput {
    const restrictions: Prisma.DocumentWhereInput[] = [];

    if (scope.categories) {
      restrictions.push({ category: { in: scope.categories } });
    }

    if (scope.businessIds) {
      const businessClause: Prisma.DocumentWhereInput = { businessId: { in: scope.businessIds } };
      restrictions.push(
        scope.ownContactId ? { OR: [businessClause, { contactId: scope.ownContactId }] } : businessClause,
      );
    }

    if (restrictions.length === 0) {
      return {};
    }

    const restricted: Prisma.DocumentWhereInput = { AND: restrictions };

    if (scope.sharedDocumentIds && scope.sharedDocumentIds.length > 0) {
      return { OR: [restricted, { id: { in: scope.sharedDocumentIds } }] };
    }

    return restricted;
  }
}
