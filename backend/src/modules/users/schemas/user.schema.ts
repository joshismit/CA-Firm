import { z } from 'zod';
import { UserStatus } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * User Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Field-for-field match with the frontend's already-built schemas
 * (frontend/src/modules/users/schemas/index.ts) — `inviteUserSchema`/
 * `updateUserSchema` here mirror `inviteUserSchema`/`updateUserSchema` there
 * exactly (same fields, same limits). `status` uses Prisma's generated
 * `UserStatus` enum rather than a hand-typed array so it can never drift from
 * the schema (ACTIVE/INACTIVE/INVITED/SUSPENDED/DELETED — identical values to
 * the frontend's `userStatusValues`).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

const firstName = z.string().trim().max(100, 'First name cannot exceed 100 characters');
const lastName = z.string().trim().max(100, 'Last name cannot exceed 100 characters');
const phone = z.string().trim().max(30, 'Phone cannot exceed 30 characters');
const jobTitle = z.string().trim().max(100, 'Job title cannot exceed 100 characters');

// ─── Invite ───────────────────────────────────────────────────────────────────

export const inviteUserSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  firstName: firstName.optional(),
  lastName: lastName.optional(),
  roleIds: z.array(uuid).min(1, 'Assign at least one role'),
  message: z.string().trim().max(500, 'Message cannot exceed 500 characters').optional(),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateUserSchema = z.object({
  firstName: firstName.min(1, 'First name is required').optional(),
  lastName: lastName.min(1, 'Last name is required').optional(),
  phone: phone.optional(),
  jobTitle: jobTitle.optional(),
  status: z.nativeEnum(UserStatus).optional(),
  // PRD §14.5 — grants/revokes the MANAGER coarse role (unrestricted tenant-wide data
  // visibility). Not yet in the frontend's mirrored schema — backend-only until a Manager
  // toggle is added to the user edit UI.
  isManager: z.boolean().optional(),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const userIdParamSchema = z.object({ id: uuid });
export const invitationIdParamSchema = z.object({ id: uuid });
export const userSessionParamSchema = z.object({ id: uuid, sessionId: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listUsersQuerySchema = searchPaginationSchema.extend({
  status: z.nativeEnum(UserStatus).optional(),
});
