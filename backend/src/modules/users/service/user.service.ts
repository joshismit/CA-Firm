import { Request } from 'express';
import { User, UserInvitation, UserStatus, InvitationStatus, NotificationChannel, AuditEventType } from '@prisma/client';
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
import { AuditLogRecorder } from '@modules/audit';
// Concrete path, not the `@modules/notifications` barrel — see
// `middlewares/tenant.middleware.ts`'s header comment for the module-load
// cycle this avoids (that barrel also re-exports `notificationRoutes`,
// which imports `tenantMiddleware`).
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { ContactRepository } from '@modules/contacts/repository/contact.repository';
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
 * This service only creates/resends/revokes the `UserInvitation` row and
 * queues the notification email — it never consumes `tokenHash` itself.
 * Invitation acceptance (validating the token, creating the real `User` row,
 * assigning roles) lives in `AuthService.acceptInvite()` instead, since the
 * accept endpoint is public/unauthenticated (`POST /auth/invite/:token/accept`)
 * like every other pre-login auth flow, not a `users:manage`-gated admin
 * action like the rest of this service. Self-service registration remains
 * unimplemented (no tenant self-service signup exists yet).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class UserService extends BaseService {
  constructor(
    req: Request,
    private readonly userRepository: UserRepository = new UserRepository(prisma),
    private readonly userInvitationRepository: UserInvitationRepository = new UserInvitationRepository(prisma),
    private readonly notificationDispatchService: NotificationDispatchService = new NotificationDispatchService(),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
    private readonly contactRepository: ContactRepository = new ContactRepository(prisma),
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

  /**
   * PRD §14.5 — admin-initiated force-logout of one specific session ("log this device out"),
   * without deactivating the whole account. The self-service equivalent
   * (`AuthService.revokeSession()`) only ever operates on the caller's own session; this is the
   * one-user-acting-on-another counterpart, so — unlike that method — it's audit-logged.
   */
  async revokeUserSession(userId: string, sessionId: string): Promise<void> {
    const user = await this.getUserById(userId);

    const revoked = await this.userRepository.revokeUserSession(sessionId, userId, user.tenantId);
    if (!revoked) {
      throw new NotFoundError('Session');
    }

    this.logger.info({ userId, sessionId }, 'Admin revoked user session');

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.SESSION_REVOKED,
        description: `Revoked a session for ${user.firstName} ${user.lastName}`,
        targetType: 'User',
        targetId: user.id,
        ipAddress: this.req.ip ?? null,
      });
    }
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
    const updated = await this.transaction(async (tx) => {
      const result = await this.userRepository.update(id, dto, { tenantId: this.tenantId, tx });
      await this.userRepository.revokeAllSessionsAndTokens(id, existing.tenantId, tx);
      return result;
    });

    // Notifying the deactivated user themselves is pointless (their sessions
    // are gone and they can't act on it); the tenant owner is the meaningful
    // audience — skip only when the owner is the one who did this themselves.
    await this.notifyOwnerUnlessActor(
      existing.tenantId,
      'User deactivated',
      `${existing.firstName} ${existing.lastName} was deactivated.`,
    );

    return updated;
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

    // Client-portal provisioning: `dto.contactId` links this invitation to a pre-existing
    // Contact so `AuthService.acceptInvite()` can stamp `Contact.portalUserId` once the invitee
    // creates their account. Omitted for ordinary staff invites.
    if (dto.contactId) {
      const contact = await this.contactRepository.findById(dto.contactId, { tenantId });
      this.validateExists(contact, 'Contact');
      if (contact.portalUserId) {
        throw new ConflictError('This contact already has a linked portal user.');
      }
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
      contactId: dto.contactId ?? null,
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

    const updated = await this.userInvitationRepository.update(invitationId, this.tenantId as string, {
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

    await this.userInvitationRepository.update(invitationId, this.tenantId as string, {
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
   * (BullMQ, consumed by `workers/email.worker.ts`) rather than sending
   * inline via `mailTransport`, so a slow/down SMTP relay or Redis hiccup
   * never blocks or fails the invite/resend HTTP response. Not awaited
   * deliberately — only the failure to *enqueue* is logged; a delivery
   * failure after that point is the worker's own retry/DLQ concern, not this
   * request's.
   */
  private queueInvitationEmail(invitation: UserInvitation, rawToken: string): void {
    const acceptUrl = `${env.FRONTEND_URL}/invite/${rawToken}`;

    emailQueue
      .add('user-invitation', {
        to: invitation.email,
        subject: `You've been invited to join ${env.APP_NAME}`,
        template: 'user-invitation',
        tenantId: invitation.tenantId,
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

  /**
   * Tenant-wide events with no more specific per-record recipient notify the
   * tenant's owner — skipped when the owner is the one who performed the
   * action themselves (nothing useful to tell them about their own change).
   * IN_APP-only: no PRD text mandates EMAIL/SMS/WhatsApp for this event.
   */
  private async notifyOwnerUnlessActor(tenantId: string, title: string, message: string): Promise<void> {
    const owner = await this.userRepository.findOwnerByTenant(tenantId);
    if (!owner || owner.id === this.userId) return;

    try {
      await this.notificationDispatchService.send({ tenantId, userId: owner.id, title, message, channels: [NotificationChannel.IN_APP] });
    } catch (err) {
      this.logger.warn({ err, tenantId, title }, 'Failed to dispatch notification');
    }
  }
}
