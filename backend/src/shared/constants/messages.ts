/**
 * Common API response messages.
 * Centralise all user-facing strings to allow easy localization later.
 */
export const MESSAGES = {
  SUCCESS: 'Success',
  CREATED: 'Created successfully',
  UPDATED: 'Updated successfully',
  DELETED: 'Deleted successfully',
  FETCHED: 'Fetched successfully',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'You do not have permission to perform this action',
  VALIDATION_ERROR: 'Validation failed',
  INTERNAL_ERROR: 'An unexpected error occurred',
  BAD_REQUEST: 'Invalid request',
  CONFLICT: 'Resource already exists',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later.',
  // Auth
  LOGIN_SUCCESS: 'Logged in successfully',
  LOGOUT_SUCCESS: 'Logged out successfully',
  TOKEN_REFRESHED: 'Token refreshed successfully',
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_DISABLED: 'Your account has been disabled',
  // Tenant
  TENANT_NOT_FOUND: 'Tenant not found',
  TENANT_INACTIVE: 'This tenant account is inactive',
} as const;
