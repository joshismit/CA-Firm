/**
 * ─────────────────────────────────────────────────────────────────────────────
 * shared/constants — Barrel Export
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Single entry point for all application-wide constants.
 *   Import from '@shared/constants' everywhere.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export { HTTP_STATUS } from './http-status';
export type { HttpStatus } from './http-status';

export { MESSAGES } from './messages';
export type { MessageKey } from './messages';

export {
  PAGINATION,
  OTP,
  UPLOAD,
  CACHE_TTL,
  PASSWORD,
  TOKEN,
  SESSION,
  LOCALE,
  RATE_LIMIT,
  AUDIT,
  BILLING,
  WHITE_LABEL,
  API,
  TASK_REMINDER,
  BILLING_REMINDER,
  COMPLIANCE_REMINDER,
  DOCUMENT_REMINDER,
  INTEGRATION_SYNC_SCAN,
} from './api.constants';

export { REGEX } from './regex';
export type { RegexKey } from './regex';

export { DATE_FORMAT, TIMEZONE } from './date-formats';

export {
  SUPPORTED_DOCUMENT_TYPES,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  SUPPORTED_DOCUMENT_MIME_TYPES,
  BLOCKED_EXECUTABLE_EXTENSIONS,
} from './file-types.constants';
export type { SupportedDocumentType } from './file-types.constants';
