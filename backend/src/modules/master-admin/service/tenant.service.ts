import { Request } from 'express';
import { Tenant, TenantStatus, RoleType, NotificationChannel } from '@prisma/client';
import { prisma } from '@config/database';
import { env } from '@config/environment';
import { emailQueue } from '@config/queue';
import { BaseService } from '@shared/base';
import { PaginationMeta } from '@shared/types';
import { TOKEN } from '@shared/constants';
import { CryptoUtils } from '@shared/utils';
// Concrete paths, not the `@modules/notifications`/`@modules/roles`/`@modules/permissions`/
// `@modules/users` barrels — see `middlewares/tenant.middleware.ts`'s header comment for why.
// Each barrel deliberately doesn't export its repository (see those modules' `index.ts` headers),
// but this module already reaches into `UserRepository` directly below for the same reason:
// a read/write-mostly operation these repositories already shape correctly, not worth
// duplicating behind another module's service.
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { UserRepository } from '@modules/users/repository/user.repository';
import { UserInvitationRepository } from '@modules/users/repository/user-invitation.repository';
import { RoleRepository } from '@modules/roles/repository/role.repository';
import { PermissionRepository } from '@modules/permissions/repository/permission.repository';
import { TenantRepository } from '../repository/tenant.repository';
import { TenantMapper, TenantWithUserCount } from '../mapper/tenant.mapper';
import { CreateTenantDto, ListTenantsQueryDto, UpdateTenantLimitsDto, UpdateTenantStatusDto } from '../dto/master-admin.req.dto';
import { TenantDetailResponseDto, TenantResponseDto } from '../dto/master-admin.res.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Service (Master Admin)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for the platform-admin tenant panel: create a tenant (plus
 * its owner's bootstrap invite), list every tenant, inspect one tenant's
 * usage, and change its status/plan limits. `createTenant()` is the only
 * provisioning path — self-service signup (`modules/auth`'s `register()`
 * stub) is deliberately not built; see that method's own comment for how it
 * composes with the invite system.
 *
 * Unlike every other module's service, this one is NOT scoped by
 * `this.tenantId` — a master admin operates across every tenant, so
 * `TenantRepository`'s queries are intentionally unscoped.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TenantService extends BaseService {
  constructor(
    req: Request,
    private readonly tenantRepository: TenantRepository = new TenantRepository(prisma),
    private readonly userRepository: UserRepository = new UserRepository(prisma),
    private readonly userInvitationRepository: UserInvitationRepository = new UserInvitationRepository(prisma),
    private readonly roleRepository: RoleRepository = new RoleRepository(prisma),
    private readonly permissionRepository: PermissionRepository = new PermissionRepository(prisma),
    private readonly notificationDispatchService: NotificationDispatchService = new NotificationDispatchService(),
  ) {
    super(req);
  }

  /**
   * Creates a `Tenant` + its `TenantSettings` + a full-access `Owner` role,
   * then issues the owner's bootstrap `UserInvitation` — all in one
   * transaction, mirroring `AuthService.acceptInvite()`'s "partial failure
   * must not leave a half-provisioned tenant" reasoning. The invitation is
   * master-admin-issued (`invitedByMasterAdminId: this.userId`, `isOwner:
   * true`) rather than `User`-issued — see `UserInvitation.invitedById`'s
   * schema comment for why that column pair exists — and is otherwise
   * accepted through the exact same `GET/POST /auth/invite/:token` flow as a
   * staff invitation.
   *
   * No pre-check for a colliding `slug` — `Tenant.slug` is unique, so a
   * collision throws Prisma `P2002`, already turned into a generic 409 by
   * the global error middleware (mirrors `LeadService.convertToClient()`'s
   * reliance on the same behavior for a colliding `clientId`).
   */
  async createTenant(dto: CreateTenantDto): Promise<TenantDetailResponseDto> {
    const slug = dto.slug ?? this.slugify(dto.name);

    const rawToken = CryptoUtils.generateRandomToken(TOKEN.SECURE_BYTES);
    const expiresAt = new Date(Date.now() + TOKEN.INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);

    const tenant = await this.transaction(async (tx) => {
      const createdTenant = await this.tenantRepository.create(
        {
          slug,
          name: dto.name,
          country: dto.country,
          timezone: dto.timezone,
          locale: dto.locale,
          defaultCurrency: dto.defaultCurrency,
          planCode: dto.planCode ?? null,
          // The schema default is TRIAL, but `AuthService.login()` refuses any login at all
          // (`tenant.status !== ACTIVE` → 403 TENANT_INACTIVE) until a master admin flips it —
          // a master-admin-provisioned tenant must be usable the moment its owner sets a
          // password, not stuck requiring a second manual activation step.
          status: TenantStatus.ACTIVE,
        },
        tx,
      );

      await tx.tenantSettings.create({ data: { tenantId: createdTenant.id } });

      const ownerRole = await this.roleRepository.create(
        { name: 'Owner', description: 'Full access to every module.', type: RoleType.SYSTEM },
        { tenantId: createdTenant.id, tx },
      );

      const permissions = await this.permissionRepository.findAll();
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId: ownerRole.id, permissionId: permission.id, grantedById: null })),
        });
      }

      await this.userInvitationRepository.create(
        {
          tenantId: createdTenant.id,
          email: dto.ownerEmail,
          firstName: dto.ownerFirstName,
          lastName: dto.ownerLastName,
          invitedById: null,
          invitedByMasterAdminId: this.userId as string,
          isOwner: true,
          roleIds: [ownerRole.id],
          tokenHash: CryptoUtils.sha256(rawToken),
          expiresAt,
        },
        tx,
      );

      return createdTenant;
    });

    this.logger.info({ tenantId: tenant.id }, 'Master admin created tenant');
    this.queueOwnerInvitationEmail(tenant, dto, rawToken, expiresAt);

    const usage = await this.tenantRepository.getUsage(tenant.id);
    return TenantMapper.toDetailResponseDto(tenant, usage);
  }

  async listTenants(query: ListTenantsQueryDto): Promise<{ data: TenantResponseDto[]; meta: PaginationMeta }> {
    const { data, meta } = await this.tenantRepository.search(
      { status: query.status, search: query.search },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
    );

    return { data: TenantMapper.toResponseDtoList(data as TenantWithUserCount[]), meta };
  }

  async getTenantById(id: string): Promise<TenantDetailResponseDto> {
    const tenant = await this.tenantRepository.findById(id);
    this.validateExists(tenant, 'Tenant');

    const usage = await this.tenantRepository.getUsage(id);
    return TenantMapper.toDetailResponseDto(tenant, usage);
  }

  async updateStatus(id: string, dto: UpdateTenantStatusDto): Promise<TenantDetailResponseDto> {
    const existing = await this.requireTenant(id);

    this.logger.info({ tenantId: id, status: dto.status }, 'Master admin changing tenant status');
    const updated = await this.tenantRepository.updateStatus(id, dto.status);

    // Only a genuine transition into SUSPENDED/ACTIVE is notify-worthy — a
    // no-op re-set to the same status (naturally possible here, unlike
    // Task/Project status changes, since this update has no transition
    // guard rejecting it) must not re-fire.
    if (dto.status !== existing.status) {
      if (dto.status === TenantStatus.SUSPENDED) {
        await this.notifyOwner(id, 'Account suspended', 'Your organisation\'s account has been suspended. Contact support for details.');
      } else if (dto.status === TenantStatus.ACTIVE) {
        await this.notifyOwner(id, 'Account activated', 'Your organisation\'s account is now active.');
      }
    }

    const usage = await this.tenantRepository.getUsage(id);
    return TenantMapper.toDetailResponseDto(updated, usage);
  }

  async updateLimits(id: string, dto: UpdateTenantLimitsDto): Promise<TenantDetailResponseDto> {
    await this.requireTenant(id);

    this.logger.info({ tenantId: id }, 'Master admin changing tenant plan/limits');
    const updated = await this.tenantRepository.updateLimits(id, dto);

    const usage = await this.tenantRepository.getUsage(id);
    return TenantMapper.toDetailResponseDto(updated, usage);
  }

  private async requireTenant(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findById(id);
    this.validateExists(tenant, 'Tenant');
    return tenant;
  }

  /**
   * IN_APP-only — no PRD text mandates EMAIL/SMS/WhatsApp for this event.
   * No self-notify concern here (unlike other modules' helpers): the actor
   * is a `MasterAdmin`, a wholly different entity/ID space from the tenant
   * `User` being notified, so it can never equal the recipient.
   */
  private async notifyOwner(tenantId: string, title: string, message: string): Promise<void> {
    const owner = await this.userRepository.findOwnerByTenant(tenantId);
    if (!owner) return;

    try {
      await this.notificationDispatchService.send({ tenantId, userId: owner.id, title, message, channels: [NotificationChannel.IN_APP] });
    } catch (err) {
      this.logger.warn({ err, tenantId, title }, 'Failed to dispatch notification');
    }
  }

  private slugify(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  /**
   * Same fire-and-forget `emailQueue`/`'user-invitation'` template as
   * `UserService.queueInvitationEmail()` — only the subject differs (a
   * tenant-flavored welcome rather than a "join the team" line), since the
   * template body's generic wording already reads fine for an owner too.
   */
  private queueOwnerInvitationEmail(tenant: Tenant, dto: CreateTenantDto, rawToken: string, expiresAt: Date): void {
    const acceptUrl = `${env.FRONTEND_URL}/invite/${rawToken}`;

    emailQueue
      .add('user-invitation', {
        to: dto.ownerEmail,
        subject: `You've been invited to set up ${tenant.name} on ${env.APP_NAME}`,
        template: 'user-invitation',
        context: {
          firstName: dto.ownerFirstName,
          acceptUrl,
          expiresAt: expiresAt.toISOString(),
        },
      })
      .catch((err: unknown) => {
        this.logger.warn({ err, tenantId: tenant.id }, 'Failed to enqueue owner invitation email');
      });
  }
}
