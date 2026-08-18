import { PrismaClient, Permission, PermissionGroup } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Permission Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the read-only `Permission`/`PermissionGroup` catalog, plus
 * single-grant `RolePermission` toggling for the permission matrix. Neither
 * `Permission` nor `PermissionGroup` carry a `tenantId` — they are a global,
 * system-owned catalog (seeded via `prisma/seeds/permissions.seed.ts`), so
 * this is deliberately NOT a `BaseRepository<TDelegate, TEntity>` subclass —
 * that base class's tenant-scoping (`applyFilters`) does not apply here.
 * Mirrors the same "bespoke repository when the shape doesn't fit
 * BaseRepository" precedent as `modules/auth/repository/auth.repository.ts`.
 *
 * `grantPermission`/`revokePermission` toggle exactly ONE `RolePermission`
 * row — deliberately distinct from
 * `modules/roles/repository/role.repository.ts`'s `replacePermissions()`,
 * which deletes and recreates a role's ENTIRE permission set. Using that
 * method here would wipe out every other grant on the role.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class PermissionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Permission[]> {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  async findById(id: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({ where: { id } });
  }

  async findAllGroups(): Promise<PermissionGroup[]> {
    return this.prisma.permissionGroup.findMany({ orderBy: { displayOrder: 'asc' } });
  }

  /** The set of `Permission.id`s currently granted to this role, for building the matrix's `granted` flags. */
  async findGrantedPermissionIds(roleId: string): Promise<Set<string>> {
    const grants = await this.prisma.rolePermission.findMany({ where: { roleId }, select: { permissionId: true } });
    return new Set(grants.map((g) => g.permissionId));
  }

  /** Idempotent — upserts on the `uq_role_permission` unique constraint, so granting an already-granted permission is a no-op rather than a conflict. */
  async grantPermission(roleId: string, permissionId: string, grantedById: string): Promise<void> {
    await this.prisma.rolePermission.upsert({
      where: { uq_role_permission: { roleId, permissionId } },
      create: { roleId, permissionId, grantedById },
      update: {},
    });
  }

  /** Idempotent — `deleteMany` so revoking an already-ungranted permission is a no-op rather than a not-found error. */
  async revokePermission(roleId: string, permissionId: string): Promise<void> {
    await this.prisma.rolePermission.deleteMany({ where: { roleId, permissionId } });
  }
}
