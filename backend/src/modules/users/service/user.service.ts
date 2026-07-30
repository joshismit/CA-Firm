import { Request } from 'express';
import { User, UserInvitation, UserStatus, InvitationStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { env } from '@config/environment';
import { emailQueue } from '@config/queue';
import { BaseService } from '@shared/base';
import { ConflictError, ForbiddenError, NotFoundError } from '@shared/errors';
import { ErrorCode } from '@shared/enums';
import { MESSAGES, TOKEN } from '@shared/constants';
import { CryptoUtils } from '@shared/utils';
import { AuthMapper } from '@modules/auth/mapper/auth.mapper';
import { SessionResponseDto } from '@modules/auth/dto/auth.res.dto';
import { PaginationMeta } from '@shared/types';
import { UserRepository } from '../repository/user.repository';
import { UserInvitationRepository } from '../repository/user-invitation.repository';
import { RoleWithPermissions } from '../mapper/user.mapper';
import { InviteUserDto, UpdateUserDto, ListUsersQueryDto } from '../dto/user.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * User Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for managing tenant staff (`User`) and their invitations
 * (`UserInvitation`). No HTTP concerns — the controller passes plain values
 * in and gets domain entities back, exactly like every other module's
 * service. Mirrors `modules/contacts/service/contact.service.ts`.
 *
 * Deliberately does not (yet) implement invitation acceptance, registration,
 * or password reset — those are separate items later in this backend's build
 * order (Invitation Acceptance / Register / Forgot Password / Reset
 * Password modules). This service only creates the `UserInvitation` row and
 * queues the notification email; nothing here consumes `tokenHash`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class UserService extends BaseService {
  constructor(
    req: Request,
    private readonly userRepository: UserRepository = new UserRepository(prisma),
    private readonly userInvitationRepository: UserInvitationRepository = new UserInvitationRepository(prisma),
  ) {
    super(req);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────────

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(user, 'User');
    return user;
  }

  async listUsers(query: ListUsersQueryDto): Promise<{ data: User[]; meta: PaginationMeta }> {
    return this.userRepository.search(
      { search: query.search, status: query.status },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { tenantId: this.tenantId },
    );
  }

  async getUserRoles(userId: string): Promise<RoleWithPermissions[]> {
    const user = await this.getUserById(userId);
    return this.userRepository.findRolesForUser(userId, user.tenantId);
  }

  async getUserSessions(userId: string): Promise<SessionResponseDto[]> {
    const user = await this.getUserById(userId);
    const sessions = await this.userRepository.findActiveSessionsForUser(userId, user.tenantId);
    // No session claim exists in this admin caller's own access token to compare against — every
    // row is necessarily some *other* user's session, so `isCurrent` is always false here (never
    // fabricated as true). Same caveat as AuthService.listSessions()'s header comment.
    return AuthMapper.toSessionResponseDtoList(sessions, undefined);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Update / Delete
  // ────────────────────────────────────────────────────────────────────────────

  async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
    const existing = await this.getUserById(id);

    if (existing.isOwner && dto.status && dto.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError("The account owner's status cannot be changed.");
    }

    this.logger.info({ userId: id }, 'Updating user');

    const isDeactivating = !!dto.status && dto.status !== UserStatus.ACTIVE && dto.status !== existing.status;
    if (!isDeactivating) {
      return this.userRepository.update(id, dto, { tenantId: this.tenantId });
    }

    // Deactivating (INACTIVE/SUSPENDED/DELETED/INVITED) revokes every active session and
    // refresh token in the same transaction, so the status change takes effect immediately
    // rather than leaving already-issued tokens valid until they naturally expire.
    return this.transaction(async (tx) => {
      const updated = await this.userRepository.update(id, dto, { tenantId: this.tenantId, tx });
      await this.userRepository.revokeAllSessionsAndTokens(id, existing.tenantId, tx);
      return updated;
    });
  }

  async deleteUser(id: string): Promise<void> {
    const existing = await this.getUserById(id);

    if (existing.isOwner) {
      throw new ForbiddenError('The account owner cannot be removed.');
    }
    if (existing.id === this.userId) {
      throw new ForbiddenError('You cannot remove your own account.');
    }

    this.logger.info({ userId: id }, 'Removing user');

    await this.transaction(async (tx) => {
      await this.userRepository.update(id, { status: UserStatus.DELETED }, { tenantId: this.tenantId, tx });
      await this.userRepository.revokeAllSessionsAndTokens(id, existing.tenantId, tx);
      await this.userRepository.delete(id, { tenantId: this.tenantId, userId: this.userId, tx });
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Invitations
  // ────────────────────────────────────────────────────────────────────────────

  async inviteUser(dto: InviteUserDto): Promise<UserInvitation> {
    const tenantId = this.tenantId as string;

    const existingUser = await this.userRepository.findByEmail(dto.email, { tenantId });
    if (existingUser) {
      throw new ConflictError(MESSAGES.EMAIL_ALREADY_EXISTS, ErrorCode.EMAIL_ALREADY_EXISTS);
    }

    const pendingInvitation = await this.userInvitationRepository.findPendingByEmail(dto.email, tenantId);
    if (pendingInvitation) {
      throw new ConflictError('An invitation is already pending for this email address.');
    }

    const roles = await this.userRepository.findActiveRolesByIds(dto.roleIds, tenantId);
    if (roles.length !== dto.roleIds.length) {
      throw new NotFoundError('Role', ErrorCode.ROLE_NOT_FOUND);
    }

    const rawToken = CryptoUtils.generateRandomToken(TOKEN.SECURE_BYTES);
    const expiresAt = new Date(Date.now() + TOKEN.INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);

    const invitation = await this.userInvitationRepository.create({
      tenantId,
      email: dto.email,
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      invitedById: this.userId as string,
      roleIds: dto.roleIds,
      tokenHash: CryptoUtils.sha256(rawToken),
      expiresAt,
      message: dto.message ?? null,
    });

    this.logger.info({ invitationId: invitation.id }, 'User invitation created');
    this.queueInvitationEmail(invitation, rawToken);

    return invitation;
  }

  async resendInvitation(invitationId: string): Promise<void> {
    const invitation = await this.userInvitationRepository.findById(invitationId, this.tenantId as string);
    this.validateExists(invitation, 'Invitation');

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictError('This invitation has already been accepted.', ErrorCode.INVITATION_ALREADY_ACCEPTED);
    }
    if (invitation.status === InvitationStatus.REVOKED) {
      throw new ConflictError('This invitation has been revoked and cannot be resent.', ErrorCode.INVITATION_INVALID);
    }

    const rawToken = CryptoUtils.generateRandomToken(TOKEN.SECURE_BYTES);
    const expiresAt = new Date(Date.now() + TOKEN.INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);

    const updated = await this.userInvitationRepository.update(invitationId, {
      tokenHash: CryptoUtils.sha256(rawToken),
      expiresAt,
      status: InvitationStatus.PENDING,
    });

    this.logger.info({ invitationId }, 'User invitation resent');
    this.queueInvitationEmail(updated, rawToken);
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    const invitation = await this.userInvitationRepository.findById(invitationId, this.tenantId as string);
    this.validateExists(invitation, 'Invitation');

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictError('This invitation has already been accepted.', ErrorCode.INVITATION_ALREADY_ACCEPTED);
    }

    await this.userInvitationRepository.update(invitationId, {
      status: InvitationStatus.REVOKED,
      revokedAt: new Date(),
    });

    this.logger.info({ invitationId }, 'User invitation revoked');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Fire-and-forget: queues the invitation email onto the shared `emailQueue`
   * (BullMQ) rather than sending inline via `mailTransport`, so a slow/down
   * SMTP relay or Redis hiccup never blocks or fails the invite/resend HTTP
   * response. Not awaited deliberately — only the failure to *enqueue* is
   * logged; there is no worker in this codebase yet that consumes
   * `QUEUE_NAMES.EMAIL` (out of scope for the Users module), so delivery
   * itself happens once that worker exists.
   */
  private queueInvitationEmail(invitation: UserInvitation, rawToken: string): void {
    const acceptUrl = `${env.FRONTEND_URL}/invite/${rawToken}`;

    emailQueue
      .add('user-invitation', {
        to: invitation.email,
        subject: `You've been invited to join ${env.APP_NAME}`,
        template: 'user-invitation',
        context: {
          firstName: invitation.firstName,
          acceptUrl,
          expiresAt: invitation.expiresAt.toISOString(),
        },
      })
      .catch((err: unknown) => {
        this.logger.warn({ err, invitationId: invitation.id }, 'Failed to enqueue invitation email');
      });
  }
}
