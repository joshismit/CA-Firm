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
  API,
} from './api.constants';

export { REGEX } from './regex';
export type { RegexKey } from './regex';

export { DATE_FORMAT, TIMEZONE } from './date-formats';
