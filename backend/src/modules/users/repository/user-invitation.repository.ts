import { PrismaClient, Prisma, UserInvitation, InvitationStatus } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * User Invitation Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for `UserInvitation`. Deliberately NOT a
 * `BaseRepository<TDelegate, TEntity>` subclass — that base class's
 * `applyFilters()` unconditionally injects a `deletedAt: null` filter unless
 * `ignoreSoftDelete` is passed, but `UserInvitation` has no `deletedAt`
 * column at all (its lifecycle is the `status` enum — PENDING/ACCEPTED/
 * EXPIRED/REVOKED — not soft delete). Mirrors the same
 * "bespoke repository when the shape doesn't fit BaseRepository" precedent as
 * `modules/auth/repository/auth.repository.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class UserInvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.UserInvitationUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<UserInvitation> {
    const client = tx ?? this.prisma;
    return client.userInvitation.create({ data });
  }

  async findById(id: string, tenantId: string): Promise<UserInvitation | null> {
    return this.prisma.userInvitation.findFirst({ where: { id, tenantId } });
  }

  /** Used to reject a second invite for an email that already has a PENDING invitation in this tenant. */
  async findPendingByEmail(email: string, tenantId: string): Promise<UserInvitation | null> {
    return this.prisma.userInvitation.findFirst({ where: { email, tenantId, status: InvitationStatus.PENDING } });
  }

  /** Resolves the invitation a raw invite token hashes to — not tenant-scoped up front, mirroring `AuthRepository.findRefreshTokenByHash()`: the token itself (not a tenant slug) is the only thing `GET /auth/invite/:token` has to resolve by. */
  async findByTokenHash(tokenHash: string): Promise<UserInvitation | null> {
    return this.prisma.userInvitation.findUnique({ where: { tokenHash } });
  }

  /**
   * `tenantId` is enforced on the update itself (via `updateMany` + re-fetch), not just trusted
   * from the caller's prior `findById` lookup — defense-in-depth, matching `RoleRepository
   * .deleteUserRoleAssignment()`'s same fix. `data` is the `Unchecked` variant (scalar FKs, e.g.
   * `acceptedById`) rather than `UserInvitationUpdateInput` (relation `connect`) because
   * `updateMany()` doesn't support nested relation writes at all — only the checked `update()`
   * (unique `where`) does.
   */
  async update(id: string, tenantId: string, data: Prisma.UserInvitationUncheckedUpdateInput, tx?: Prisma.TransactionClient): Promise<UserInvitation> {
    const client = tx ?? this.prisma;
    await client.userInvitation.updateMany({ where: { id, tenantId }, data });
    return client.userInvitation.findFirstOrThrow({ where: { id, tenantId } });
  }
}
