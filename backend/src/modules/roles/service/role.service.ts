import { Request } from 'express';
import { RoleType, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError, ForbiddenError, NotFoundError } from '@shared/errors';
import { ErrorCode } from '@shared/enums';
import { PaginationMeta } from '@shared/types';
import { UserMapper } from '@modules/users/mapper/user.mapper';
import { UserResponseDto } from '@modules/users/dto/user.res.dto';
import { AuditLogRecorder } from '@modules/audit';
import { RoleRepository } from '../repository/role.repository';
import { RoleWithPermissions } from '../mapper/role.mapper';
import { CreateRoleDto, UpdateRoleDto, ListRolesQueryDto, AssignRoleDto } from '../dto/role.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Role Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for `Role`, its granted `Permission`s, and `UserRole`
 * assignments. No HTTP concerns — the controller passes plain values in and
 * gets domain results back, exactly like every other module's service.
 * Mirrors `modules/contacts/service/contact.service.ts`.
 *
 * `getRoleUsers()` reaches into the Users module's `UserMapper` directly
 * (not through its barrel, which deliberately doesn't export it) — the same
 * precedent `UserService` already set by importing `AuthMapper` directly
 * from `modules/auth/mapper/auth.mapper.ts`. A mapper is a pure, stateless
 * function; reusing it here avoids re-implementing the exact same
 * `User -> UserResponseDto` field mapping a second time.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class RoleService extends BaseService {
  constructor(
    req: Request,
    private readonly roleRepository: RoleRepository = new RoleRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {
    super(req);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────────

  async getRoleById(id: string): Promise<RoleWithPermissions> {
    const role = await this.roleRepository.findByIdWithPermissions(id, { tenantId: this.tenantId });
    this.validateExists(role, 'Role');
    return role;
  }

  async listRoles(query: ListRolesQueryDto): Promise<{ data: RoleWithPermissions[]; meta: PaginationMeta }> {
    return this.roleRepository.search(
      { search: query.search, type: query.type },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { tenantId: this.tenantId },
    );
  }

  async getRoleUsers(roleId: string): Promise<UserResponseDto[]> {
    const role = await this.getRoleById(roleId);
    const users = await this.roleRepository.findActiveUsersForRole(roleId, role.tenantId);
    return UserMapper.toResponseDtoList(users);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Create / Update / Delete
  // ────────────────────────────────────────────────────────────────────────────

  async createRole(dto: CreateRoleDto): Promise<RoleWithPermissions> {
    const permissions = await this.roleRepository.findPermissionsByCodes(dto.permissionCodes);
    if (permissions.length !== dto.permissionCodes.length) {
      throw new NotFoundError('Permission');
    }

    this.logger.info({ name: dto.name }, 'Creating role');

    const created = await this.transaction(async (tx) => {
      const role = await this.roleRepository.create(
        { name: dto.name, description: dto.description ?? null, color: dto.color ?? null, createdById: this.userId },
        { tenantId: this.tenantId, tx },
      );
      await this.roleRepository.replacePermissions(role.id, permissions.map((p) => p.id), this.userId as string, tx);
      return role;
    });

    return this.getRoleById(created.id);
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleWithPermissions> {
    const existing = await this.getRoleById(id);

    if (existing.type === RoleType.SYSTEM) {
      throw new ForbiddenError('System roles cannot be modified.', ErrorCode.ROLE_IMMUTABLE);
    }

    let permissionIds: string[] | undefined;
    if (dto.permissionCodes) {
      const permissions = await this.roleRepository.findPermissionsByCodes(dto.permissionCodes);
      if (permissions.length !== dto.permissionCodes.length) {
        throw new NotFoundError('Permission');
      }
      permissionIds = permissions.map((p) => p.id);
    }

    const { permissionCodes: _permissionCodes, ...roleFields } = dto;

    this.logger.info({ roleId: id }, 'Updating role');

    await this.transaction(async (tx) => {
      if (Object.keys(roleFields).length > 0) {
        await this.roleRepository.update(id, roleFields, { tenantId: this.tenantId, tx });
      }
      if (permissionIds) {
        await this.roleRepository.replacePermissions(id, permissionIds, this.userId as string, tx);
      }
    });

    if (permissionIds) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId as string,
        actorId: this.userId as string,
        eventType: AuditEventType.PERMISSION_CHANGE,
        description: `Changed permissions for role "${existing.name}"`,
        targetType: 'Role',
        targetId: id,
        ipAddress: this.req.ip ?? null,
      });
    }

    return this.getRoleById(id);
  }

  async deleteRole(id: string): Promise<void> {
    const existing = await this.getRoleById(id);

    if (existing.type === RoleType.SYSTEM) {
      throw new ForbiddenError('System roles cannot be deleted.', ErrorCode.ROLE_IMMUTABLE);
    }

    this.logger.info({ roleId: id }, 'Deleting role');

    await this.roleRepository.delete(id, { tenantId: this.tenantId, userId: this.userId });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Assign / Revoke
  // ────────────────────────────────────────────────────────────────────────────

  async assignRole(dto: AssignRoleDto): Promise<void> {
    const tenantId = this.tenantId as string;

    const role = await this.roleRepository.findById(dto.roleId, { tenantId });
    this.validateExists(role, 'Role');

    const userExists = await this.roleRepository.userExistsInTenant(dto.userId, tenantId);
    if (!userExists) {
      this.throwNotFound('User', ErrorCode.USER_NOT_FOUND);
    }

    const existing = await this.roleRepository.findUserRoleAssignment(dto.userId, dto.roleId, tenantId);
    if (existing) {
      throw new ConflictError('This user already has this role assigned.');
    }

    this.logger.info({ userId: dto.userId, roleId: dto.roleId }, 'Assigning role');

    await this.roleRepository.createUserRoleAssignment({
      tenantId,
      userId: dto.userId,
      roleId: dto.roleId,
      assignedById: this.userId as string,
      expiresAt: dto.expiresAt ?? null,
    });

    await this.auditLogRecorder.record({
      tenantId,
      actorId: this.userId as string,
      eventType: AuditEventType.ROLE_CHANGE,
      description: `Assigned role "${role.name}"`,
      targetType: 'User',
      targetId: dto.userId,
      ipAddress: this.req.ip ?? null,
    });
  }

  async revokeRole(dto: AssignRoleDto): Promise<void> {
    const tenantId = this.tenantId as string;

    const assignment = await this.roleRepository.findUserRoleAssignment(dto.userId, dto.roleId, tenantId);
    this.validateExists(assignment, 'Role assignment');

    const role = await this.roleRepository.findById(dto.roleId, { tenantId });

    this.logger.info({ userId: dto.userId, roleId: dto.roleId }, 'Revoking role');

    await this.roleRepository.deleteUserRoleAssignment(assignment.id);

    await this.auditLogRecorder.record({
      tenantId,
      actorId: this.userId as string,
      eventType: AuditEventType.ROLE_CHANGE,
      description: `Revoked role "${role?.name ?? dto.roleId}"`,
      targetType: 'User',
      targetId: dto.userId,
      ipAddress: this.req.ip ?? null,
    });
  }
}
