import { Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@config/database';
import { jwtConfig } from '@config/jwt';
import { JwtPayload } from '@middlewares/auth.middleware';
import { BaseService } from '@shared/base';
import { UnauthorizedError, ForbiddenError } from '@shared/errors';
import { ErrorCode, UserRole } from '@shared/enums';
import { MESSAGES } from '@shared/constants';
import { MasterAdminRepository } from '../repository/master-admin.repository';
import { TenantMapper } from '../mapper/tenant.mapper';
import { MasterAdminLoginDto } from '../dto/master-admin.req.dto';
import { MasterAdminLoginResponseDto } from '../dto/master-admin.res.dto';

/** Master admin tokens live longer than a tenant user's 15-minute access token — there is no
 *  refresh flow to silently extend the session (see `MasterAdmin`'s header comment in
 *  schema.prisma), so a short expiry would just mean re-entering credentials constantly for what
 *  is, in practice, a small number of trusted internal operators. */
const MASTER_ADMIN_TOKEN_EXPIRY_SECONDS = 12 * 60 * 60; // 12 hours

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Admin Auth Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Login for the platform-level admin panel. Deliberately separate from
 * `modules/auth/service/auth.service.ts`'s `login()` — a `MasterAdmin` is not
 * a `User` row (no tenant, no session/refresh-token rows to create, since
 * those tables FK to `User.id`). The issued JWT carries `role: MASTER_ADMIN`
 * and omits `tenantId`/`permissions` (`requireRole()` gates master-admin
 * routes, not `requirePermission()` — there is nothing to resolve).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class MasterAdminAuthService extends BaseService {
  constructor(
    req: Request,
    private readonly masterAdminRepository: MasterAdminRepository = new MasterAdminRepository(prisma),
  ) {
    super(req);
  }

  async login(dto: MasterAdminLoginDto): Promise<MasterAdminLoginResponseDto> {
    const admin = await this.masterAdminRepository.findByEmail(dto.email);

    if (!admin) {
      throw new UnauthorizedError(MESSAGES.INVALID_CREDENTIALS, ErrorCode.INVALID_CREDENTIALS);
    }

    if (!admin.isActive) {
      throw new ForbiddenError(MESSAGES.ACCOUNT_INACTIVE, ErrorCode.ACCOUNT_INACTIVE);
    }

    const passwordValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedError(MESSAGES.INVALID_CREDENTIALS, ErrorCode.INVALID_CREDENTIALS);
    }

    await this.masterAdminRepository.recordLogin(admin.id);

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: admin.id,
      email: admin.email,
      role: UserRole.MASTER_ADMIN,
      permissions: [],
    };
    const accessToken = jwt.sign(payload, jwtConfig.access.secret, {
      expiresIn: MASTER_ADMIN_TOKEN_EXPIRY_SECONDS,
    });

    return {
      accessToken,
      admin: TenantMapper.toAdminResponseDto(admin),
    };
  }
}
