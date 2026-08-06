import { randomUUID } from 'crypto';
import { Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  User,
  UserInvitation,
  TenantStatus,
  UserStatus,
  InvitationStatus,
  SessionDeviceType,
  SessionRevokeReason,
  RefreshTokenRevokeReason,
  LoginEventType,
  LoginEventStatus,
  AuditEventType,
  NotificationChannel,
} from '@prisma/client';
import { prisma } from '@config/database';
import { env } from '@config/environment';
import { emailQueue } from '@config/queue';
import { jwtConfig } from '@config/jwt';
import { BaseService } from '@shared/base';
import { UnauthorizedError, ForbiddenError, ConflictError, NotFoundError } from '@shared/errors';
import { ErrorCode, UserRole } from '@shared/enums';
import { MESSAGES, PASSWORD, TOKEN } from '@shared/constants';
import { CryptoUtils } from '@shared/utils';
import { JwtPayload } from '@middlewares/auth.middleware';
import { AuditLogRecorder } from '@modules/audit';
// Concrete path, not the `@modules/notifications` barrel — that barrel also
// re-exports `notificationRoutes`, which imports `tenantMiddleware`; see
// that file's header comment for the module-load cycle this avoids.
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { UserRepository } from '@modules/users/repository/user.repository';
import { UserInvitationRepository } from '@modules/users/repository/user-invitation.repository';
import { AuthRepository } from '../repository/auth.repository';
import { AuthMapper } from '../mapper/auth.mapper';
import { detectBrowser, detectOs } from '../utils/user-agent.util';
import {
  LoginDto,
  RefreshTokenDto,
  LogoutDto,
  RevokeAllSessionsDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AcceptInviteDto,
  RequestMeta,
} from '../dto/auth.req.dto';
import { LoginResponseDto, RefreshResponseDto, MeResponseDto, SessionResponseDto, InviteInfoResponseDto } from '../dto/auth.res.dto';

/** "Remember me" extends the session/refresh-token horizon to 30 days instead of TOKEN.REFRESH_EXPIRY_SECONDS' default 7. */
const REMEMBER_ME_REFRESH_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for login, refresh-token rotation, logout, session
 * management, and self-service password change. No HTTP concerns — the
 * controller passes plain values in and gets domain results back, exactly
 * like every other module's service.
 *
 * `login()` deliberately does NOT scope the user lookup by tenant: the
 * frontend's already-built `LoginRequest` type (frontend/src/modules/auth/
 * types/index.ts) is `{ email, password, rememberMe }` — no tenant slug/id —
 * so the only way to resolve which tenant a login belongs to is the user's
 * email alone. `User.email` is uniquely constrained per-tenant
 * (`@@unique([tenantId, email])`), not globally, so this relies on email not
 * actually being reused across tenants in practice; the DB does not enforce
 * that. Revisit if/when the frontend adds a tenant-selection step.
 *
 * The JWT's `role` claim is a coarse tier (`UserRole` from `@shared/enums`:
 * MASTER_ADMIN/TENANT_ADMIN/MANAGER/STAFF/CLIENT) used only for structural
 * gating (e.g. the frontend's Master Admin portal guard) — it is NOT how
 * authorization actually works. `User` has no `role` column at all; the real,
 * fine-grained RBAC comes from `permissions` (resolved fresh at every
 * login/refresh via `AuthRepository.resolvePermissionCodes()`:
 * UserRole → Role → RolePermission → Permission.code), which is what
 * `requirePermission()` checks. `resolveRole()` maps a user to the coarse
 * tier via `isOwner` (no MASTER_ADMIN/CLIENT path — Master Admin isn't a
 * tenant-scoped `User` row in this schema, and Client Portal auth is a
 * separate, not-yet-built initiative).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class AuthService extends BaseService {
  constructor(
    req: Request,
    private readonly authRepository: AuthRepository = new AuthRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
    // Reused directly from the Users module — the same "reach into another
    // module's own repository/mapper when it's already the right shape"
    // precedent `RoleService` sets by importing `UserMapper` (see this
    // class's constructor's sibling in modules/roles/service/role.service.ts).
    // Password reset needs `revokeAllSessionsAndTokens()` (Users owns admin-
    // grade session/token revocation); invitation acceptance needs the
    // `UserInvitation` lifecycle Users already owns end-to-end.
    private readonly userRepository: UserRepository = new UserRepository(prisma),
    private readonly userInvitationRepository: UserInvitationRepository = new UserInvitationRepository(prisma),
    private readonly notificationDispatchService: NotificationDispatchService = new NotificationDispatchService(),
  ) {
    super(req);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Login / Refresh / Logout
  // ────────────────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResponseDto> {
    const user = await this.authRepository.findUserByEmail(dto.email);

    if (!user) {
      await this.recordFailedLogin(undefined, dto.email, meta);
      throw new UnauthorizedError(MESSAGES.INVALID_CREDENTIALS, ErrorCode.INVALID_CREDENTIALS);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenError(MESSAGES.ACCOUNT_LOCKED, ErrorCode.ACCOUNT_LOCKED);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError(MESSAGES.ACCOUNT_INACTIVE, ErrorCode.ACCOUNT_INACTIVE);
    }

    const passwordValid = user.passwordHash ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!passwordValid) {
      await this.recordFailedLogin(user, dto.email, meta);
      throw new UnauthorizedError(MESSAGES.INVALID_CREDENTIALS, ErrorCode.INVALID_CREDENTIALS);
    }

    const tenant = await this.authRepository.findTenantById(user.tenantId);
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      throw new ForbiddenError(MESSAGES.TENANT_INACTIVE, ErrorCode.TENANT_INACTIVE);
    }

    const permissions = await this.authRepository.resolvePermissionCodes(user.id);
    const role = this.resolveRole(user);

    const refreshExpirySeconds = dto.rememberMe ? REMEMBER_ME_REFRESH_EXPIRY_SECONDS : TOKEN.REFRESH_EXPIRY_SECONDS;
    const expiresAt = new Date(Date.now() + refreshExpirySeconds * 1000);

    // Unique per-session identifier hash — nothing currently reads it back (access-token
    // revocation would need a session claim in the JWT, deliberately not added; see this
    // class's header comment), but the column is NOT NULL + UNIQUE, so a real random value is
    // stored rather than a placeholder.
    const session = await this.authRepository.createSession({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: CryptoUtils.sha256(CryptoUtils.generateRandomToken(TOKEN.SECURE_BYTES)),
      deviceType: SessionDeviceType.WEB,
      browser: detectBrowser(meta.userAgent),
      os: detectOs(meta.userAgent),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      expiresAt,
    });

    const rawRefreshToken = CryptoUtils.generateRandomToken(TOKEN.SECURE_BYTES);
    await this.authRepository.createRefreshToken({
      tenantId: user.tenantId,
      userId: user.id,
      sessionId: session.id,
      tokenHash: CryptoUtils.sha256(rawRefreshToken),
      familyId: randomUUID(),
      sequence: 1,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.authRepository.recordSuccessfulLogin(user.id);
    await this.authRepository.recordLoginHistory({
      tenantId: user.tenantId,
      userId: user.id,
      email: user.email,
      eventType: LoginEventType.LOGIN,
      status: LoginEventStatus.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      sessionId: session.id,
    });
    await this.auditLogRecorder.record({
      tenantId: user.tenantId,
      actorId: user.id,
      eventType: AuditEventType.LOGIN,
      description: `${user.email} logged in`,
      ipAddress: meta.ipAddress,
    });

    this.logger.info({ userId: user.id }, 'User logged in');

    return {
      accessToken: this.signAccessToken({ sub: user.id, email: user.email, role, tenantId: user.tenantId, permissions }),
      refreshToken: rawRefreshToken,
      user: AuthMapper.toAuthUserDto(user, role, permissions),
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, planCode: tenant.planCode, isActive: tenant.status === TenantStatus.ACTIVE },
    };
  }

  /**
   * Rotates the refresh token (one-time use). If a token that was already
   * marked used is presented again, that's a reuse signal (stolen/replayed
   * token) — the entire rotation family and its session are revoked rather
   * than just rejecting the one request.
   */
  async refresh(dto: RefreshTokenDto, meta: RequestMeta): Promise<RefreshResponseDto> {
    const tokenRow = await this.authRepository.findRefreshTokenByHash(CryptoUtils.sha256(dto.refreshToken));

    if (!tokenRow) {
      throw new UnauthorizedError('Invalid refresh token.', ErrorCode.TOKEN_INVALID);
    }

    if (tokenRow.isUsed) {
      await this.authRepository.revokeRefreshTokenFamily(tokenRow.familyId, RefreshTokenRevokeReason.FAMILY_COMPROMISED);
      await this.authRepository.revokeSession(tokenRow.sessionId, SessionRevokeReason.SUSPICIOUS_ACTIVITY);
      throw new UnauthorizedError(
        'This refresh token has already been used. All sessions have been signed out for your safety.',
        ErrorCode.REFRESH_TOKEN_REUSE,
      );
    }

    if (tokenRow.revokedAt || tokenRow.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired or been revoked.', ErrorCode.REFRESH_TOKEN_EXPIRED);
    }

    const user = await this.authRepository.findUserById(tokenRow.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError(MESSAGES.ACCOUNT_INACTIVE, ErrorCode.ACCOUNT_INACTIVE);
    }

    const permissions = await this.authRepository.resolvePermissionCodes(user.id);
    const role = this.resolveRole(user);

    const newRawRefreshToken = CryptoUtils.generateRandomToken(TOKEN.SECURE_BYTES);
    const newTokenRow = await this.authRepository.createRefreshToken({
      tenantId: tokenRow.tenantId,
      userId: user.id,
      sessionId: tokenRow.sessionId,
      tokenHash: CryptoUtils.sha256(newRawRefreshToken),
      familyId: tokenRow.familyId,
      sequence: tokenRow.sequence + 1,
      // Keeps the session's original expiry horizon rather than resetting it on every refresh.
      expiresAt: tokenRow.expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.authRepository.markRefreshTokenUsed(tokenRow.id, newTokenRow.id);
    await this.authRepository.touchSession(tokenRow.sessionId);
    await this.authRepository.recordLoginHistory({
      tenantId: user.tenantId,
      userId: user.id,
      email: user.email,
      eventType: LoginEventType.TOKEN_REFRESH,
      status: LoginEventStatus.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      sessionId: tokenRow.sessionId,
    });

    return {
      accessToken: this.signAccessToken({ sub: user.id, email: user.email, role, tenantId: user.tenantId, permissions }),
      refreshToken: newRawRefreshToken,
    };
  }

  /** Ends the one session identified by `refreshToken` — the token itself is the session identifier (see this class's header comment on why no session claim exists in the access token). */
  async logout(dto: LogoutDto): Promise<void> {
    const userId = this.requireUserId();

    const tokenRow = await this.authRepository.findRefreshTokenByHash(CryptoUtils.sha256(dto.refreshToken));
    if (tokenRow && tokenRow.userId === userId) {
      await this.authRepository.revokeRefreshTokensBySession(tokenRow.sessionId, RefreshTokenRevokeReason.LOGOUT);
      await this.authRepository.revokeSession(tokenRow.sessionId, SessionRevokeReason.LOGOUT);
    }

    // `req.user.tenantId`/`email` come straight off the JWT (authMiddleware), not `this.tenantId`
    // (only set once tenantMiddleware runs, which auth routes don't) — see AuditLogRecorder's
    // header comment on why every param here is explicit rather than derived from BaseService.
    if (this.req.user?.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.req.user.tenantId,
        actorId: userId,
        eventType: AuditEventType.LOGOUT,
        description: `${this.req.user.email} logged out`,
        ipAddress: this.req.ip ?? null,
      });
    }

    this.logger.info({ userId }, 'User logged out');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Profile / Password
  // ────────────────────────────────────────────────────────────────────────────

  async me(): Promise<MeResponseDto> {
    const userId = this.requireUserId();
    const user = await this.authRepository.findUserById(userId);
    this.validateExists(user, 'User');

    const permissions = await this.authRepository.resolvePermissionCodes(userId);
    return AuthMapper.toMeResponseDto(user, this.resolveRole(user), permissions);
  }

  /**
   * Verifies the current password, rejects reuse of any of the last
   * `PASSWORD.HISTORY_DEPTH` passwords (including the current one), then
   * revokes every active session for this user (including the one making
   * this request) — a password change forces re-authentication everywhere,
   * a deliberate, common security trade-off given there's no session claim
   * to exempt the calling session by.
   */
  async changePassword(dto: ChangePasswordDto): Promise<void> {
    const userId = this.requireUserId();
    const user = await this.authRepository.findUserById(userId);
    this.validateExists(user, 'User');

    const currentValid = user.passwordHash ? await bcrypt.compare(dto.currentPassword, user.passwordHash) : false;
    if (!currentValid) {
      throw new UnauthorizedError('Current password is incorrect.', ErrorCode.INVALID_CREDENTIALS);
    }

    const recentHashes = await this.authRepository.getRecentPasswordHashes(userId, PASSWORD.HISTORY_DEPTH);
    const candidateHashes = user.passwordHash ? [user.passwordHash, ...recentHashes] : recentHashes;
    for (const oldHash of candidateHashes) {
      // eslint-disable-next-line no-await-in-loop -- small, bounded (HISTORY_DEPTH) sequential check.
      if (await bcrypt.compare(dto.newPassword, oldHash)) {
        throw new ConflictError(`You cannot reuse one of your last ${PASSWORD.HISTORY_DEPTH} passwords.`);
      }
    }

    const newHash = await bcrypt.hash(dto.newPassword, PASSWORD.BCRYPT_ROUNDS);
    if (user.passwordHash) {
      await this.authRepository.createPasswordHistory(user.tenantId, userId, user.passwordHash);
    }
    await this.authRepository.updatePassword(userId, newHash);
    await this.authRepository.revokeAllSessionsExcept(userId, undefined, SessionRevokeReason.PASSWORD_CHANGE);

    this.logger.info({ userId }, 'Password changed');
    await this.notify(user.tenantId, userId, 'Password changed', 'Your password was changed. If this wasn\'t you, contact your administrator immediately.');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Forgot / Reset Password
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Always resolves the same way regardless of whether `dto.email` matches a
   * real, active user — no branch here is observable from the response,
   * which is the only defense against user enumeration that actually works
   * (a timing difference between "did work" and "did nothing" is a much
   * weaker guarantee, and not attempted here). Real work — token issuance +
   * email — only happens for a genuine `ACTIVE` user.
   */
  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMeta): Promise<void> {
    const user = await this.authRepository.findUserByEmail(dto.email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      this.logger.info({ email: dto.email }, 'Password reset requested for unknown/inactive email — no-op');
      return;
    }

    // At most one usable reset link at a time — an older, still-unexpired
    // link from an earlier request must not remain valid once a newer one
    // is issued (prevents a stale, possibly-leaked link from working
    // indefinitely across repeated forgot-password requests).
    await this.authRepository.invalidatePasswordResetTokens(user.id);

    const rawToken = CryptoUtils.generateRandomToken(TOKEN.SECURE_BYTES);
    const expiresAt = new Date(Date.now() + TOKEN.PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

    await this.authRepository.createPasswordResetToken({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: CryptoUtils.sha256(rawToken),
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.authRepository.recordLoginHistory({
      tenantId: user.tenantId,
      userId: user.id,
      email: user.email,
      eventType: LoginEventType.PASSWORD_RESET_REQUEST,
      status: LoginEventStatus.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    this.queuePasswordResetEmail(user, rawToken, expiresAt);

    this.logger.info({ userId: user.id }, 'Password reset requested');
  }

  /**
   * One-time use, enforced by `isUsed`/`revokedAt`/`expiresAt` all checked
   * against the same DB row the presented token hashes to — a replayed
   * (already-used) or superseded (revoked by a later forgot-password
   * request) or lapsed token is rejected identically, via the same generic
   * message, so none of those states is distinguishable from the outside.
   * Revokes every session AND every refresh token for the user (not just
   * sessions — `UserRepository.revokeAllSessionsAndTokens()` does both in
   * one call, reused as-is from the Users module rather than re-implemented
   * here), since a password reset is exactly the scenario an attacker with a
   * stolen refresh token must be locked out by.
   */
  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta): Promise<void> {
    const invalidTokenError = () =>
      new UnauthorizedError('This password reset link is invalid or has expired.', ErrorCode.TOKEN_INVALID);

    const tokenRow = await this.authRepository.findPasswordResetTokenByHash(CryptoUtils.sha256(dto.token));
    if (!tokenRow || tokenRow.isUsed || tokenRow.revokedAt || tokenRow.expiresAt < new Date()) {
      throw invalidTokenError();
    }

    const user = await this.authRepository.findUserById(tokenRow.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw invalidTokenError();
    }

    const newHash = await bcrypt.hash(dto.newPassword, PASSWORD.BCRYPT_ROUNDS);

    await this.transaction(async (tx) => {
      // Marking the token used first means a concurrent second request
      // racing on the same raw token can't both succeed — the loser's
      // subsequent `updatePassword` still runs, but only ever with the same
      // `newHash` outcome as the winner would have produced from the same
      // request body, so this is a benign, not exploitable, race.
      await this.authRepository.markPasswordResetTokenUsed(tokenRow.id, tx);
      await this.authRepository.updatePassword(user.id, newHash, tx);
      await this.userRepository.revokeAllSessionsAndTokens(user.id, user.tenantId, tx);
    });

    await this.authRepository.recordLoginHistory({
      tenantId: user.tenantId,
      userId: user.id,
      email: user.email,
      eventType: LoginEventType.PASSWORD_RESET_SUCCESS,
      status: LoginEventStatus.SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.auditLogRecorder.record({
      tenantId: user.tenantId,
      actorId: user.id,
      eventType: AuditEventType.PASSWORD_RESET,
      description: `${user.email} reset their password`,
      ipAddress: meta.ipAddress,
    });

    this.logger.info({ userId: user.id }, 'Password reset completed');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Invitation Acceptance
  // ────────────────────────────────────────────────────────────────────────────

  /** Preview shown before the accept form — resolves the same `UserInvitation` `acceptInvite()` below consumes, but performs no write. */
  async getInviteInfo(token: string): Promise<InviteInfoResponseDto> {
    const invitation = await this.resolvePendingInvitationOrThrow(token, () => new NotFoundError('Invitation', ErrorCode.INVITATION_INVALID));

    const [tenant, inviter, roles] = await Promise.all([
      this.authRepository.findTenantById(invitation.tenantId),
      invitation.invitedById ? this.authRepository.findUserById(invitation.invitedById) : Promise.resolve(null),
      this.userRepository.findActiveRolesByIds(invitation.roleIds, invitation.tenantId),
    ]);

    // A master-admin-issued invitation (the tenant owner's bootstrap invite) has no inviting
    // `User` to name — `MasterAdmin` is a deliberately separate entity/ID space, see this
    // service's header comment — so it gets a generic, non-personal label instead of blank text.
    const inviterName = inviter
      ? `${inviter.firstName} ${inviter.lastName}`.trim()
      : invitation.invitedByMasterAdminId
        ? 'The Platform Team'
        : '';

    return {
      email: invitation.email,
      tenantName: tenant?.name ?? '',
      inviterName,
      role: roles.map((r) => r.name).join(', '),
    };
  }

  /**
   * Creates the real `User` row for the first time (an invited person has no
   * `User` row at all until this call — `UserService.inviteUser()` only ever
   * creates the `UserInvitation`; see that method's header comment), assigns
   * every role the invitation carried, and marks the invitation `ACCEPTED`
   * with `acceptedById` pointing at the just-created user — all inside one
   * transaction so a partial failure can't leave an activated user with no
   * roles, or an invitation stuck `PENDING` after the user already exists.
   */
  async acceptInvite(token: string, dto: AcceptInviteDto, meta: RequestMeta): Promise<void> {
    const invalidInvitationError = () => new UnauthorizedError(MESSAGES.INVITATION_INVALID, ErrorCode.INVITATION_INVALID);
    const invitation = await this.resolvePendingInvitationOrThrow(token, invalidInvitationError);

    // Belt-and-suspenders: `UserService.inviteUser()` already refuses a
    // second invite while a User with this email exists, but a lot can
    // happen in the days between an invite being sent and accepted.
    const existingUser = await this.userRepository.findByEmail(invitation.email, { tenantId: invitation.tenantId });
    if (existingUser) {
      throw new ConflictError(MESSAGES.EMAIL_ALREADY_EXISTS, ErrorCode.EMAIL_ALREADY_EXISTS);
    }

    const { firstName, lastName } = this.splitFullName(dto.fullName);
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD.BCRYPT_ROUNDS);

    const user = await this.transaction(async (tx) => {
      const createdUser = await this.userRepository.create(
        {
          email: invitation.email,
          passwordHash,
          firstName,
          lastName,
          status: UserStatus.ACTIVE,
          isOwner: invitation.isOwner,
          emailVerifiedAt: new Date(),
        },
        { tenantId: invitation.tenantId, tx },
      );

      // A master-admin-issued invitation (the tenant owner's bootstrap invite) has no inviting
      // `User` — fall back to the role being self-assigned by the very user it's granted to,
      // since `UserRole.assignedById` stays a required FK (unlike `UserInvitation.invitedById`,
      // deliberately not migrated to nullable — see this method's header comment).
      const roleAssignedById = invitation.invitedById ?? createdUser.id;

      if (invitation.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: invitation.roleIds.map((roleId) => ({
            tenantId: invitation.tenantId,
            userId: createdUser.id,
            roleId,
            assignedById: roleAssignedById,
          })),
        });
      }

      await this.userInvitationRepository.update(
        invitation.id,
        { status: InvitationStatus.ACCEPTED, acceptedAt: new Date(), acceptedBy: { connect: { id: createdUser.id } } },
        tx,
      );

      return createdUser;
    });

    await this.auditLogRecorder.record({
      tenantId: invitation.tenantId,
      actorId: user.id,
      eventType: AuditEventType.INVITATION_ACCEPTED,
      description: `${user.email} accepted their invitation and joined the team`,
      targetType: 'User',
      targetId: user.id,
      ipAddress: meta.ipAddress,
    });

    this.logger.info({ userId: user.id, invitationId: invitation.id }, 'Invitation accepted');

    // No inviting `User` to notify for a master-admin-issued (tenant owner) invitation —
    // `NotificationDispatchService` is User-scoped only, and there's nothing to send here.
    if (invitation.invitedById) {
      await this.notify(
        invitation.tenantId,
        invitation.invitedById,
        'Invitation accepted',
        `${user.firstName} ${user.lastName} accepted your invitation and joined the team.`,
      );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Sessions
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * `isCurrent` is always `false` on every row: identifying "this one" would
   * require a session claim in the access token, which this module
   * deliberately doesn't add (see this class's header comment). Honest
   * degraded behavior, not a fabricated guess.
   */
  async listSessions(): Promise<SessionResponseDto[]> {
    const userId = this.requireUserId();
    const sessions = await this.authRepository.findActiveSessionsByUser(userId);
    return AuthMapper.toSessionResponseDtoList(sessions, undefined);
  }

  async revokeSession(sessionId: string): Promise<void> {
    const userId = this.requireUserId();
    const session = await this.authRepository.findSessionById(sessionId, userId);
    this.validateExists(session, 'Session');

    await this.authRepository.revokeRefreshTokensBySession(sessionId, RefreshTokenRevokeReason.SESSION_REVOKED);
    await this.authRepository.revokeSession(sessionId, SessionRevokeReason.DEVICE_REMOVED);
  }

  /** Revokes every active session except the one identified by `refreshToken` (if provided/valid) — omitting it revokes every session, including the caller's own. */
  async logoutAllSessions(dto: RevokeAllSessionsDto): Promise<{ revokedCount: number }> {
    const userId = this.requireUserId();

    let exceptSessionId: string | undefined;
    if (dto.refreshToken) {
      const tokenRow = await this.authRepository.findRefreshTokenByHash(CryptoUtils.sha256(dto.refreshToken));
      if (tokenRow && tokenRow.userId === userId) exceptSessionId = tokenRow.sessionId;
    }

    const revokedCount = await this.authRepository.revokeAllSessionsExcept(userId, exceptSessionId, SessionRevokeReason.LOGOUT);
    return { revokedCount };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────────

  private requireUserId(): string {
    if (!this.userId) throw new UnauthorizedError();
    return this.userId;
  }

  private resolveRole(user: User): UserRole {
    return user.isOwner ? UserRole.TENANT_ADMIN : UserRole.STAFF;
  }

  private signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, jwtConfig.access.secret, { expiresIn: jwtConfig.access.expiresIn } as jwt.SignOptions);
  }

  private async recordFailedLogin(user: User | undefined, email: string, meta: RequestMeta): Promise<void> {
    if (user) {
      const failedLoginCount = user.failedLoginCount + 1;
      const justLocked = failedLoginCount >= PASSWORD.MAX_FAILED_ATTEMPTS;
      const lockedUntil = justLocked ? new Date(Date.now() + PASSWORD.LOCKOUT_DURATION_MINUTES * 60 * 1000) : null;
      await this.authRepository.recordFailedLogin(user.id, failedLoginCount, lockedUntil);

      // Fires exactly once per lockout: `login()` short-circuits with a
      // ForbiddenError *before* ever calling this method again while
      // `lockedUntil` is still in the future (see that method's
      // `lockedUntil > new Date()` check), so a burst of retries against an
      // already-locked account never re-enters this branch.
      if (justLocked) {
        await this.notify(
          user.tenantId,
          user.id,
          'Account locked',
          `Your account was temporarily locked after ${PASSWORD.MAX_FAILED_ATTEMPTS} failed sign-in attempts. It will unlock automatically in ${PASSWORD.LOCKOUT_DURATION_MINUTES} minutes.`,
        );
      }
    }

    await this.authRepository.recordLoginHistory({
      tenantId: user?.tenantId,
      userId: user?.id,
      email,
      eventType: LoginEventType.FAILED_LOGIN,
      status: LoginEventStatus.FAILURE,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      failureReason: 'Invalid credentials',
    });
  }

  /** Shared by `getInviteInfo()` and `acceptInvite()` — both resolve-by-token then reject identically on anything other than a still-`PENDING`, unexpired invitation. A `PENDING` invitation found past its `expiresAt` is persisted as `EXPIRED` here (no scheduled job exists anywhere in this codebase to do it proactively — the same reasoning `tenantMiddleware` applies to a lapsed subscription) so the tenant's own invitation list reflects reality instead of staying `PENDING` forever. */
  private async resolvePendingInvitationOrThrow(token: string, makeError: () => Error): Promise<UserInvitation> {
    const invitation = await this.userInvitationRepository.findByTokenHash(CryptoUtils.sha256(token));
    if (!invitation) {
      throw makeError();
    }

    if (invitation.status === InvitationStatus.PENDING && invitation.expiresAt < new Date()) {
      await this.userInvitationRepository.update(invitation.id, { status: InvitationStatus.EXPIRED });
      throw makeError();
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw makeError();
    }

    return invitation;
  }

  /**
   * Splits a single "full name" form field into the `firstName`/`lastName`
   * columns `User` requires — the first word is `firstName`, everything
   * after is `lastName`; a single-word name gets an empty-string `lastName`
   * rather than duplicating the first name into it (honest about what the
   * user actually typed, not a fabricated guess).
   */
  private splitFullName(fullName: string): { firstName: string; lastName: string } {
    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    return { firstName, lastName: rest.join(' ') };
  }

  /** Fire-and-forget onto the shared `emailQueue`, mirroring `UserService.queueInvitationEmail()` exactly (same queue, same not-awaited/log-on-enqueue-failure shape) — see that method's header comment for why this is deliberately not awaited. */
  private queuePasswordResetEmail(user: User, rawToken: string, expiresAt: Date): void {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    emailQueue
      .add('password-reset', {
        to: user.email,
        subject: `Reset your ${env.APP_NAME} password`,
        template: 'password-reset',
        tenantId: user.tenantId,
        context: {
          firstName: user.firstName,
          resetUrl,
          expiresAt: expiresAt.toISOString(),
        },
      })
      .catch((err: unknown) => {
        this.logger.warn({ err, userId: user.id }, 'Failed to enqueue password reset email');
      });
  }

  /**
   * IN_APP-only business-event notification — no PRD text mandates EMAIL/SMS/
   * WhatsApp for any of the events this module fires one for, so only the
   * channel that's always generated is used (see `NotificationDispatchService`'s
   * own header comment on `IN_APP` never touching the queue). Best-effort: a
   * failure to notify must never fail the auth action that already
   * succeeded and already committed, so this is awaited but its own errors
   * are caught and logged, exactly like `AuditLogRecorder.record()`.
   */
  private async notify(tenantId: string, userId: string, title: string, message: string): Promise<void> {
    try {
      await this.notificationDispatchService.send({ tenantId, userId, title, message, channels: [NotificationChannel.IN_APP] });
    } catch (err) {
      this.logger.warn({ err, userId, title }, 'Failed to dispatch notification');
    }
  }
}
