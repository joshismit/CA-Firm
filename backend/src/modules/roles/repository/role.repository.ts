import { PrismaClient, Prisma, Role, RoleType, Permission, User, UserRole } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';
import { RoleWithPermissions } from '../mapper/role.mapper';

export interface RoleSearchFilters {
  /** Matches against the role name (case-insensitive). */
  search?: string;
  type?: RoleType;
}

/** Shared `include` shape that resolves `RolePermission -> Permission.code` for a `Role` row. */
const PERMISSIONS_INCLUDE = {
  rolePermissions: { include: { permission: { select: { code: true } } } },
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Role Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `Role` entity, plus the cross-entity operations the
 * Roles module needs: resolving `permissionCodes` to `Permission` rows,
 * replacing a role's granted permissions, and reading/writing `UserRole`
 * assignments. Inherits tenant scoping and standard CRUD/pagination from
 * `BaseRepository`, but overrides `delete()` — `Role` has `deletedAt` but no
 * `deletedBy` column (same situation as `ContactRepository`, see that
 * class's comment). Mirrors `modules/contacts/repository/contact.repository.ts`.
 *
 * `findById`/`paginate` (inherited) return a plain `Role` per BaseRepository's
 * generic `Entity` type — `search()`/`findByIdWithPermissions()` widen the
 * query with `PERMISSIONS_INCLUDE` and cast to `RoleWithPermissions`, since
 * the shared generic can't express an ad-hoc `include` shape. The cast
 * reflects the real runtime shape Prisma returns, not a workaround for
 * missing data.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class RoleRepository extends BaseRepository<Prisma.RoleDelegate, Role> {
  constructor(prisma: PrismaClient) {
    super(prisma.role, prisma);
  }

  async search(
    filters: RoleSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: RoleWithPermissions[]; meta: PaginationMeta }> {
    const where: Prisma.RoleWhereInput = {};

    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const result = await this.paginate(pagination, where, options, PERMISSIONS_INCLUDE);
    return result as unknown as { data: RoleWithPermissions[]; meta: PaginationMeta };
  }

  async findByIdWithPermissions(id: string, options: RepositoryOptions = {}): Promise<RoleWithPermissions | null> {
    const role = await this.findById(id, options, PERMISSIONS_INCLUDE);
    return role as unknown as RoleWithPermissions | null;
  }

  /**
   * `Role` has no `deletedBy` column (unlike Project/Task/Business) —
   * BaseRepository.delete() unconditionally includes `deletedBy` in its
   * update payload, which Prisma rejects as an unknown field for this model.
   * Overridden here with identical soft-delete semantics minus that field,
   * rather than modifying the shared BaseRepository.
   */
  async delete(id: string, options: RepositoryOptions = {}): Promise<boolean> {
    const where = this.applyFilters({ id }, options);
    const client = this.getClient(options.tx);
    const result = (await client.updateMany({ where, data: { deletedAt: new Date() } })) as { count: number };
    return result.count > 0;
  }

  /** Resolves `permissionCodes` (a flat string array from the frontend's own static registry) to their `Permission` rows. `Permission` is a global catalog, not tenant-scoped. */
  async findPermissionsByCodes(codes: string[]): Promise<Permission[]> {
    return this.prisma.permission.findMany({ where: { code: { in: codes } } });
  }

  /** Replaces a role's entire granted-permission set (delete all, then re-create) — matches the frontend checklist UI, which always submits the complete desired state, not a diff. */
  async replacePermissions(
    roleId: string,
    permissionIds: string[],
    grantedById: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length === 0) return;
    await tx.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId, grantedById })),
    });
  }

  /** Existence check scoped to this tenant — used to reject assigning a role to a user from another tenant (the `UserRole.userId` FK alone would not catch this: the user row exists, just in a different tenant). */
  async userExistsInTenant(userId: string, tenantId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null }, select: { id: true } });
    return !!user;
  }

  async findUserRoleAssignment(userId: string, roleId: string, tenantId: string): Promise<UserRole | null> {
    return this.prisma.userRole.findFirst({ where: { userId, roleId, tenantId } });
  }

  async createUserRoleAssignment(data: Prisma.UserRoleUncheckedCreateInput): Promise<UserRole> {
    return this.prisma.userRole.create({ data });
  }

  async deleteUserRoleAssignment(id: string): Promise<void> {
    await this.prisma.userRole.delete({ where: { id } });
  }

  /** Users currently holding this role (excluding expired assignments and soft-deleted users) — for GET /roles/:id/users. */
  async findActiveUsersForRole(roleId: string, tenantId: string): Promise<User[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        roleId,
        tenantId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        user: { deletedAt: null },
      },
      include: { user: true },
      orderBy: { assignedAt: 'desc' },
    });

    return assignments.map((assignment) => assignment.user);
  }
}
