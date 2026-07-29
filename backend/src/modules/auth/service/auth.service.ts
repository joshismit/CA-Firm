import { randomUUID } from 'crypto';
import { Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  User,
  TenantStatus,
  UserStatus,
  SessionDeviceType,
  SessionStatus,
  SessionRevokeReason,
  RefreshTokenRevokeReason,
  LoginEventType,
  LoginEventStatus,
} from '@prisma/client';
import { prisma } from '@config/database';
import { jwtConfig } from '@config/jwt';
import { BaseService } from '@shared/base';
import { UnauthorizedError, ForbiddenError, ConflictError } from '@shared/errors';
import { ErrorCode, UserRole } from '@shared/enums';
import { MESSAGES, PASSWORD, TOKEN } from '@shared/constants';
import { CryptoUtils } from '@shared/utils';
import { JwtPayload } from '@middlewares/auth.middleware';
import { AuthRepository } from '../repository/auth.repository';
import { AuthMapper } from '../mapper/auth.mapper';
import { detectBrowser, detectOs } from '../utils/user-agent.util';
import { LoginDto, RefreshTokenDto, LogoutDto, RevokeAllSessionsDto, ChangePasswordDto, RequestMeta } from '../dto/auth.req.dto';
import { LoginResponseDto, RefreshResponseDto, MeResponseDto, SessionResponseDto } from '../dto/auth.res.dto';

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
      const lockedUntil =
        failedLoginCount >= PASSWORD.MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + PASSWORD.LOCKOUT_DURATION_MINUTES * 60 * 1000)
          : null;
      await this.authRepository.recordFailedLogin(user.id, failedLoginCount, lockedUntil);
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
}
