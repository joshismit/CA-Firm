import { z } from 'zod';
import {
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  revokeAllSessionsSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  inviteTokenParamSchema,
  acceptInviteSchema,
} from '../schemas/auth.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/auth.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
export type LogoutDto = z.infer<typeof logoutSchema>;
export type RevokeAllSessionsDto = z.infer<typeof revokeAllSessionsSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type InviteTokenParamDto = z.infer<typeof inviteTokenParamSchema>;
export type AcceptInviteDto = z.infer<typeof acceptInviteSchema>;

/** Not user input — populated by the controller from the raw Express request (IP/User-Agent). */
export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}
