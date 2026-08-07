import {
  PrismaClient,
  Prisma,
  User,
  UserSession,
  Role,
  SessionStatus,
  SessionRevokeReason,
  RefreshTokenRevokeReason,
} from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';
import { RoleWithPermissions } from '../mapper/user.mapper';

export interface UserSearchFilters {
  /** Matches against firstName, lastName, or email (case-insensitive). */
  search?: string;
  status?: User['status'];
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * User Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `User` entity, plus the read-only cross-entity lookups
 * the Users module needs (a user's assigned `Role`s, a user's active
 * `UserSession`s) that don't belong on a `User`-scoped `BaseRepository`.
 * Inherits tenant scoping and standard CRUD/pagination from `BaseRepository`
 * (unlike `ContactRepository`, `User` has a `deletedBy` column, so no
 * `delete()` override is needed). Mirrors
 * `modules/contacts/repository/contact.repository.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class UserRepository extends BaseRepository<Prisma.UserDelegate, User> {
  constructor(prisma: PrismaClient) {
    super(prisma.user, prisma);
  }

  async search(
    filters: UserSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: User[]; meta: PaginationMeta }> {
    const where: Prisma.UserWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.paginate(pagination, where, options);
  }

  async findByEmail(email: string, options: RepositoryOptions = {}): Promise<User | null> {
    return this.findFirst({ email }, options);
  }

  /**
   * The tenant's designated primary contact — used as the notification
   * recipient for tenant-wide events (subscription/tenant-status changes,
   * a staff deactivation) that have no more specific per-record assignee to
   * notify instead. `isOwner` is exactly one `User` per tenant by convention
   * (enforced at tenant-provisioning time, not by a DB constraint), so this
   * is a `findFirst`, not a list.
   */
  async findOwnerByTenant(tenantId: string): Promise<User | null> {
    return this.findFirst({ isOwner: true }, { tenantId });
  }

  /**
   * Resolves the tenant's active, non-deleted roles matching the given IDs —
   * used to validate `InviteUserDto.roleIds` before creating an invitation.
   * Returns fewer rows than `roleIds.length` if some IDs don't exist, are
   * inactive, soft-deleted, or belong to a different tenant.
   */
  async findActiveRolesByIds(roleIds: string[], tenantId: string, tx?: Prisma.TransactionClient): Promise<Role[]> {
    const client = tx ?? this.prisma;
    return client.role.findMany({
      where: { id: { in: roleIds }, tenantId, isActive: true, deletedAt: null },
    });
  }

  /**
   * A user's assigned roles (via `UserRole`, excluding expired assignments),
   * each with its `rolePermissions -> permission.code` resolved — the same
   * per-role shape `UserMapper.toRoleResponseDto()` expects. Mirrors the
   * `UserRole -> Role -> RolePermission -> Permission` traversal in
   * `AuthRepository.resolvePermissionCodes()`, kept per-role instead of
   * flattened into a single code set.
   */
  async findRolesForUser(userId: string, tenantId: string): Promise<RoleWithPermissions[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId,
        tenantId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        role: { deletedAt: null },
      },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: { select: { code: true } } } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return assignments.map((assignment) => assignment.role);
  }

  /** A user's active sessions, scoped to this tenant — the admin-facing counterpart of `AuthRepository.findActiveSessionsByUser()` (which is self-service, caller-only). */
  async findActiveSessionsForUser(userId: string, tenantId: string): Promise<UserSession[]> {
    return this.prisma.userSession.findMany({
      where: { userId, tenantId, status: SessionStatus.ACTIVE },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  /**
   * PRD §14.5 — admin-initiated force-logout of one specific session/device, without deactivating
   * the whole account (unlike `revokeAllSessionsAndTokens()`, called on full deactivation/deletion
   * instead). Scoped to `(id, userId, tenantId)` together so an admin can only ever revoke a
   * session that both belongs to this tenant and to the target user. Returns false if no such
   * active session exists (nothing to revoke).
   */
  async revokeUserSession(sessionId: string, userId: string, tenantId: string): Promise<boolean> {
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, tenantId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date(), revokeReason: SessionRevokeReason.ADMIN_REVOKE },
    });
    if (result.count === 0) return false;

    await this.prisma.refreshToken.updateMany({
      where: { sessionId, userId, tenantId, revokedAt: null, isUsed: false },
      data: { revokedAt: new Date(), revokeReason: RefreshTokenRevokeReason.ADMIN_REVOKE },
    });
    return true;
  }

  /**
   * Revokes every active session and not-yet-used refresh token for a user —
   * called when an admin deletes a user or transitions them out of ACTIVE
   * status, so the change takes effect immediately rather than leaving
   * existing sessions valid until they naturally expire.
   */
  async revokeAllSessionsAndTokens(userId: string, tenantId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.userSession.updateMany({
      where: { userId, tenantId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date(), revokeReason: SessionRevokeReason.ADMIN_REVOKE },
    });

    await tx.refreshToken.updateMany({
      where: { userId, tenantId, revokedAt: null, isUsed: false },
      data: { revokedAt: new Date(), revokeReason: RefreshTokenRevokeReason.ADMIN_REVOKE },
    });
  }
}
