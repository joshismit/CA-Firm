import { Request } from 'express';
import { Permission, PermissionGroup, RoleType } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ForbiddenError, NotFoundError } from '@shared/errors';
import { ErrorCode } from '@shared/enums';
import { RoleService } from '@modules/roles';
import { PermissionRepository } from '../repository/permission.repository';
import { UpdatePermissionMatrixDto } from '../dto/permission.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Permission Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for the read-only `Permission`/`PermissionGroup` catalog
 * and the `RolePermission` grant matrix. No HTTP concerns — the controller
 * passes plain values in and gets domain results back, exactly like every
 * other module's service.
 *
 * Composes `RoleService` (not `RoleRepository`) for every operation that
 * touches a specific `roleId` — reuses its existing tenant-scoping,
 * not-found, and SYSTEM-role-immutability checks instead of duplicating
 * them a second time. This is a read-only, non-transactional composition
 * (no shared `tx` needed), so going through the Service is safe here —
 * unlike `modules/crm`'s lead conversion, which needed the Contacts
 * module's repository directly for transactional participation.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class PermissionService extends BaseService {
  constructor(
    req: Request,
    private readonly permissionRepository: PermissionRepository = new PermissionRepository(prisma),
    private readonly roleService: RoleService = new RoleService(req),
  ) {
    super(req);
  }

  async listPermissions(): Promise<Permission[]> {
    return this.permissionRepository.findAll();
  }

  async listPermissionGroups(): Promise<PermissionGroup[]> {
    return this.permissionRepository.findAllGroups();
  }

  /** Every catalog `Permission`, each flagged with whether this role currently holds it — the full matrix, not just the granted subset. */
  async getPermissionMatrix(roleId: string): Promise<Array<{ permissionId: string; granted: boolean }>> {
    // Validates the role exists and belongs to the caller's tenant.
    await this.roleService.getRoleById(roleId);

    const [allPermissions, grantedIds] = await Promise.all([
      this.permissionRepository.findAll(),
      this.permissionRepository.findGrantedPermissionIds(roleId),
    ]);

    return allPermissions.map((permission) => ({ permissionId: permission.id, granted: grantedIds.has(permission.id) }));
  }

  async updatePermissionMatrix(dto: UpdatePermissionMatrixDto): Promise<void> {
    const role = await this.roleService.getRoleById(dto.roleId);

    if (role.type === RoleType.SYSTEM) {
      throw new ForbiddenError('System roles cannot be modified.', ErrorCode.ROLE_IMMUTABLE);
    }

    const permission = await this.permissionRepository.findById(dto.permissionId);
    if (!permission) {
      throw new NotFoundError('Permission');
    }

    this.logger.info({ roleId: dto.roleId, permissionId: dto.permissionId, granted: dto.granted }, 'Updating permission matrix');

    if (dto.granted) {
      await this.permissionRepository.grantPermission(dto.roleId, dto.permissionId, this.userId as string);
    } else {
      await this.permissionRepository.revokePermission(dto.roleId, dto.permissionId);
    }
  }
}
