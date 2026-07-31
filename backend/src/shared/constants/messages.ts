/**
 * ─────────────────────────────────────────────────────────────────────────────
 * API Messages — Centralised User-Facing Strings
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Single source of truth for all human-readable API response messages.
 *   Centralising them here enables future i18n (internationalisation)
 *   by swapping this file for a locale-specific one.
 *
 * RULES:
 *   - Every controller/service response message must come from here.
 *   - Never hardcode a user-facing string inside a controller or service.
 *   - Messages are grouped by domain for discoverability.
 *   - Keep messages generic enough to work without knowing the caller's context.
 *
 * USAGE:
 *   import { MESSAGES } from '@shared/constants';
 *   ApiResponseHelper.success(MESSAGES.FETCHED, data);
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const MESSAGES = {

  // ─── Generic CRUD ────────────────────────────────────────────────────────

  SUCCESS: 'Success',
  CREATED: 'Created successfully',
  UPDATED: 'Updated successfully',
  DELETED: 'Deleted successfully',
  FETCHED: 'Fetched successfully',
  RESTORED: 'Restored successfully',
  EXPORTED: 'Exported successfully',
  IMPORTED: 'Imported successfully',
  ARCHIVED: 'Archived successfully',

  // ─── Generic Errors ──────────────────────────────────────────────────────

  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'You do not have permission to perform this action',
  VALIDATION_ERROR: 'Validation failed',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
  BAD_REQUEST: 'Invalid request',
  CONFLICT: 'A record with this information already exists',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again shortly.',
  NOT_IMPLEMENTED: 'This feature is not yet available',

  // ─── Authentication ───────────────────────────────────────────────────────

  LOGIN_SUCCESS: 'Logged in successfully',
  LOGOUT_SUCCESS: 'Logged out successfully',
  TOKEN_REFRESHED: 'Token refreshed successfully',
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_INACTIVE: 'Your account is inactive. Please contact your administrator.',
  ACCOUNT_LOCKED: 'Your account has been temporarily locked. Please try again in 30 minutes.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before logging in',
  PASSWORD_CHANGED: 'Password changed successfully',
  PASSWORD_RESET_SENT: 'Password reset instructions have been sent to your email',
  PASSWORD_RESET_SUCCESS: 'Password has been reset successfully',
  MFA_REQUIRED: 'Multi-factor authentication is required',
  MFA_VERIFIED: 'MFA verification successful',
  MFA_ENABLED: 'MFA has been enabled for your account',
  MFA_DISABLED: 'MFA has been disabled for your account',

  // ─── OTP ─────────────────────────────────────────────────────────────────

  OTP_SENT: 'OTP has been sent to your registered email/phone',
  OTP_VERIFIED: 'OTP verified successfully',
  OTP_INVALID: 'The OTP you entered is incorrect',
  OTP_EXPIRED: 'The OTP has expired. Please request a new one',
  OTP_MAX_ATTEMPTS: 'Too many incorrect attempts. Please request a new OTP',

  // ─── Tenant ───────────────────────────────────────────────────────────────

  TENANT_NOT_FOUND: 'Tenant not found',
  TENANT_INACTIVE: 'This organisation account is inactive. Please contact support.',
  TENANT_SUSPENDED: 'This organisation account has been suspended.',
  PLAN_LIMIT_EXCEEDED: 'You have reached the limit for your current plan. Please upgrade to continue.',
  FEATURE_NOT_ENABLED: 'This feature is not enabled for your plan.',
  TRIAL_EXPIRED: 'Your free trial has ended. Please subscribe to a plan to continue.',
  SUBSCRIPTION_INACTIVE: 'Your subscription is not active. Please check your billing.',

  // ─── Users ────────────────────────────────────────────────────────────────

  USER_NOT_FOUND: 'User not found',
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User profile updated successfully',
  USER_DELETED: 'User removed successfully',
  USER_DEACTIVATED: 'User has been deactivated',
  USER_REACTIVATED: 'User has been reactivated',
  EMAIL_ALREADY_EXISTS: 'A user with this email address already exists',
  INVITATION_SENT: 'Invitation sent successfully',
  INVITATION_ACCEPTED: 'Invitation accepted. Welcome aboard!',
  INVITATION_INVALID: 'This invitation link is invalid or has expired',
  INVITATION_REVOKED: 'Invitation has been revoked',

  // ─── RBAC ─────────────────────────────────────────────────────────────────

  ROLE_NOT_FOUND: 'Role not found',
  ROLE_CREATED: 'Role created successfully',
  ROLE_UPDATED: 'Role updated successfully',
  ROLE_DELETED: 'Role deleted successfully',
  ROLE_IMMUTABLE: 'System roles cannot be modified or deleted',
  PERMISSION_DENIED: 'You do not have the required permission for this action',
  ROLE_ASSIGNED: 'Role assigned to user successfully',
  ROLE_UNASSIGNED: 'Role removed from user successfully',

  // ─── Files / Documents ────────────────────────────────────────────────────

  FILE_UPLOADED: 'File uploaded successfully',
  FILE_DELETED: 'File deleted successfully',
  FILE_NOT_FOUND: 'File not found',
  FILE_TOO_LARGE: 'File size exceeds the maximum allowed limit',
  FILE_TYPE_NOT_ALLOWED: 'This file type is not permitted',
  FILE_MISSING: 'No file was provided',

  // ─── Pagination ───────────────────────────────────────────────────────────

  LIST_EMPTY: 'No records found matching your criteria',

} as const;

export type MessageKey = keyof typeof MESSAGES;
