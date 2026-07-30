import { z } from 'zod';
import {
  inviteUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  userIdParamSchema,
  invitationIdParamSchema,
} from '../schemas/user.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/user.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type InviteUserDto = z.infer<typeof inviteUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;
export type UserIdParamDto = z.infer<typeof userIdParamSchema>;
export type InvitationIdParamDto = z.infer<typeof invitationIdParamSchema>;
