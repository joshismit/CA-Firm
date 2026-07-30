import { UserStatus, InvitationStatus, RoleType } from '@prisma/client';

/**
 * Response DTO — deliberately omits internal-only/sensitive fields
 * (`passwordHash`, `failedLoginCount`, `lockedUntil`, `tenantId`,
 * `deletedAt`/`deletedBy`) that have no value outside the server or must
 * never be exposed to a client. Field-for-field match with the frontend's
 * already-built `User` type (frontend/src/modules/users/types/index.ts).
 */
export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: UserStatus;
  isOwner: boolean;
  avatarStorageKey: string | null;
  jobTitle: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/**
 * Response DTO for `UserInvitation` — deliberately omits `tokenHash`,
 * `invitedById`, `roleIds`, `message`, and `acceptedById` (no value to the
 * caller of the Users list/invite endpoints). Field-for-field match with the
 * frontend's `UserInvitation` type.
 */
export interface UserInvitationResponseDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

/**
 * Response DTO for a `Role` assigned to a user — field-for-field match with
 * the frontend's `Role` type (frontend/src/modules/roles/types/index.ts).
 * `permissionCodes` is resolved from `RolePermission` → `Permission.code`,
 * the same aggregation `AuthRepository.resolvePermissionCodes()` uses at
 * login, but kept per-role here (not flattened/deduped across all of the
 * user's roles) — the frontend computes the deduped union itself
 * (`UserPermissionsCard.tsx`) from this same per-role shape.
 */
export interface UserRoleResponseDto {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  type: RoleType;
  isActive: boolean;
  permissionCodes: string[];
  createdAt: string;
  updatedAt: string;
}
