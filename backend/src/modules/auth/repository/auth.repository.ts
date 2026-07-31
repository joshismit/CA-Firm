import {
  PrismaClient,
  User,
  UserSession,
  RefreshToken,
  PasswordResetToken,
  Prisma,
  SessionStatus,
  SessionRevokeReason,
  RefreshTokenRevokeReason,
  LoginEventType,
  LoginEventStatus,
} from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the login/session/refresh-token lifecycle. Deliberately NOT
 * a `BaseRepository<TDelegate, TEntity>` subclass — that base class assumes a
 * single tenant-scoped, soft-deletable entity, but this repository spans five
 * different models (`User` read-only, `UserSession`, `RefreshToken`,
 * `LoginHistory`, `UserPasswordHistory`) with different scoping rules each
 * (e.g. `findUserByEmail` is deliberately NOT tenant-scoped — see
 * `AuthService.login()`'s header comment for why). Mirrors the same
 * "bespoke repository when the shape doesn't fit BaseRepository" precedent as
 * `modules/crm/repository/client.repository.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ────────────────────────────────────────────────────────────────────────
  // User
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Intentionally not tenant-scoped: the frontend's locked `LoginRequest` type
   * carries only `{ email, password, rememberMe }`, with no tenant hint, so
   * login can only resolve by email alone. `User.email` is uniquely
   * constrained per-tenant (`@@unique([tenantId, email])`), not globally, so
   * this assumes email is in practice not reused across tenants — the DB does
   * not enforce that assumption.
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  async recordFailedLogin(userId: string, failedLoginCount: number, lockedUntil: Date | null): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { failedLoginCount, lockedUntil } });
  }

  async recordSuccessfulLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  async updatePassword(userId: string, passwordHash: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date() } });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Tenant (read-only)
  // ────────────────────────────────────────────────────────────────────────

  async findTenantById(tenantId: string) {
    return this.prisma.tenant.findUnique({ where: { id: tenantId } });
  }

  // ────────────────────────────────────────────────────────────────────────
  // RBAC resolution
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Resolves a user's effective permission codes at token-issuance time:
   * UserRole → Role (active only) → RolePermission → Permission.code.
   * Expired role assignments (`UserRole.expiresAt` in the past) are excluded.
   * This is the actual real-time RBAC computation `requirePermission()`
   * checks against (via the JWT's `permissions` claim) — `Permission`/`Role`
   * tables aren't just admin-UI metadata, this is where they're wired into
   * enforcement.
   */
  async resolvePermissionCodes(userId: string): Promise<string[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        role: { isActive: true, deletedAt: null },
      },
      select: {
        role: {
          select: {
            rolePermissions: { select: { permission: { select: { code: true } } } },
          },
        },
      },
    });

    const codes = new Set<string>();
    for (const assignment of assignments) {
      for (const rp of assignment.role.rolePermissions) {
        codes.add(rp.permission.code);
      }
    }
    return Array.from(codes);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Sessions
  // ────────────────────────────────────────────────────────────────────────

  async createSession(data: Prisma.UserSessionUncheckedCreateInput): Promise<UserSession> {
    return this.prisma.userSession.create({ data });
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.prisma.userSession.update({ where: { id: sessionId }, data: { lastActiveAt: new Date() } });
  }

  async findActiveSessionsByUser(userId: string): Promise<UserSession[]> {
    return this.prisma.userSession.findMany({
      where: { userId, status: SessionStatus.ACTIVE },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async findSessionById(id: string, userId: string): Promise<UserSession | null> {
    return this.prisma.userSession.findFirst({ where: { id, userId } });
  }

  async revokeSession(id: string, reason: SessionRevokeReason): Promise<void> {
    await this.prisma.userSession.update({
      where: { id },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date(), revokeReason: reason },
    });
  }

  async revokeAllSessionsExcept(userId: string, exceptSessionId: string | undefined, reason: SessionRevokeReason): Promise<number> {
    const result = await this.prisma.userSession.updateMany({
      where: { userId, status: SessionStatus.ACTIVE, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date(), revokeReason: reason },
    });
    return result.count;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Refresh tokens
  // ────────────────────────────────────────────────────────────────────────

  async createRefreshToken(data: Prisma.RefreshTokenUncheckedCreateInput): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async markRefreshTokenUsed(id: string, rotatedToId: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { isUsed: true, usedAt: new Date(), rotatedToId } });
  }

  /** Reuse-detection response: revoke every not-yet-used token in the rotation family. */
  async revokeRefreshTokenFamily(familyId: string, reason: RefreshTokenRevokeReason): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async revokeRefreshTokensBySession(sessionId: string, reason: RefreshTokenRevokeReason): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null, isUsed: false },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Password reset tokens
  // ────────────────────────────────────────────────────────────────────────

  async createPasswordResetToken(data: Prisma.PasswordResetTokenUncheckedCreateInput): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({ data });
  }

  async findPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async markPasswordResetTokenUsed(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.passwordResetToken.update({ where: { id }, data: { isUsed: true, usedAt: new Date() } });
  }

  /** Supersedes every still-usable token from an earlier forgot-password request before issuing a new one — at most one reset link is ever valid for a user at a time. */
  async invalidatePasswordResetTokens(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, isUsed: false, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Login history & password history
  // ────────────────────────────────────────────────────────────────────────

  async recordLoginHistory(data: {
    tenantId?: string;
    userId?: string;
    email: string;
    eventType: LoginEventType;
    status: LoginEventStatus;
    ipAddress: string | null;
    userAgent: string | null;
    sessionId?: string;
    failureReason?: string;
  }): Promise<void> {
    await this.prisma.loginHistory.create({ data });
  }

  async createPasswordHistory(tenantId: string, userId: string, passwordHash: string): Promise<void> {
    await this.prisma.userPasswordHistory.create({ data: { tenantId, userId, passwordHash } });
  }

  async getRecentPasswordHashes(userId: string, limit: number): Promise<string[]> {
    const rows = await this.prisma.userPasswordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { passwordHash: true },
    });
    return rows.map((r) => r.passwordHash);
  }
}
