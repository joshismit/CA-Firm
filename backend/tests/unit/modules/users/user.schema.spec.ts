import { UserStatus } from '@prisma/client';
import {
  inviteUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  userIdParamSchema,
  invitationIdParamSchema,
} from '@modules/users/schemas/user.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * User Zod Schemas — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the schemas directly (`.safeParse()`), independent of Express/
 * `validate()` middleware — pure input → success/failure assertions. Mirrors
 * `tests/unit/modules/crm/lead.schema.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222';

describe('inviteUserSchema', () => {
  it('accepts the minimal valid payload (email + roleIds only)', () => {
    const result = inviteUserSchema.safeParse({ email: 'new.hire@acme.test', roleIds: [VALID_UUID_1] });
    expect(result.success).toBe(true);
  });

  it('accepts a fully-populated valid payload', () => {
    const result = inviteUserSchema.safeParse({
      email: 'new.hire@acme.test',
      firstName: 'New',
      lastName: 'Hire',
      roleIds: [VALID_UUID_1, VALID_UUID_2],
      message: 'Welcome to the team!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing email', () => {
    const result = inviteUserSchema.safeParse({ roleIds: [VALID_UUID_1] });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email format', () => {
    const result = inviteUserSchema.safeParse({ email: 'not-an-email', roleIds: [VALID_UUID_1] });
    expect(result.success).toBe(false);
  });

  it('rejects an empty roleIds array', () => {
    const result = inviteUserSchema.safeParse({ email: 'new.hire@acme.test', roleIds: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a missing roleIds', () => {
    const result = inviteUserSchema.safeParse({ email: 'new.hire@acme.test' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID entry in roleIds', () => {
    const result = inviteUserSchema.safeParse({ email: 'new.hire@acme.test', roleIds: ['not-a-uuid'] });
    expect(result.success).toBe(false);
  });

  it('rejects firstName longer than 100 characters', () => {
    const result = inviteUserSchema.safeParse({
      email: 'new.hire@acme.test',
      roleIds: [VALID_UUID_1],
      firstName: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects message longer than 500 characters', () => {
    const result = inviteUserSchema.safeParse({
      email: 'new.hire@acme.test',
      roleIds: [VALID_UUID_1],
      message: 'A'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('accepts an empty object (every field optional)', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid partial update', () => {
    const result = updateUserSchema.safeParse({ firstName: 'Renamed', status: UserStatus.SUSPENDED });
    expect(result.success).toBe(true);
  });

  it('rejects an empty firstName when provided (not nullable, cannot be cleared)', () => {
    const result = updateUserSchema.safeParse({ firstName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects phone longer than 30 characters', () => {
    const result = updateUserSchema.safeParse({ phone: '1'.repeat(31) });
    expect(result.success).toBe(false);
  });

  it('rejects jobTitle longer than 100 characters', () => {
    const result = updateUserSchema.safeParse({ jobTitle: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid status value', () => {
    const result = updateUserSchema.safeParse({ status: 'NOT_A_STATUS' });
    expect(result.success).toBe(false);
  });

  it.each(Object.values(UserStatus))('accepts every valid UserStatus value (%s)', (status) => {
    const result = updateUserSchema.safeParse({ status });
    expect(result.success).toBe(true);
  });
});

describe('userIdParamSchema / invitationIdParamSchema', () => {
  it('accepts a valid UUID for userIdParamSchema', () => {
    expect(userIdParamSchema.safeParse({ id: VALID_UUID_1 }).success).toBe(true);
  });

  it('rejects a non-UUID id for userIdParamSchema', () => {
    expect(userIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });

  it('accepts a valid UUID for invitationIdParamSchema', () => {
    expect(invitationIdParamSchema.safeParse({ id: VALID_UUID_1 }).success).toBe(true);
  });

  it('rejects a missing id for invitationIdParamSchema', () => {
    expect(invitationIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('listUsersQuerySchema', () => {
  it('applies pagination defaults when nothing is provided', () => {
    const result = listUsersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
    }
  });

  it('accepts a status filter', () => {
    const result = listUsersQuerySchema.safeParse({ status: UserStatus.INVITED });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid status filter', () => {
    const result = listUsersQuerySchema.safeParse({ status: 'NOT_A_STATUS' });
    expect(result.success).toBe(false);
  });

  it('rejects a page below 1', () => {
    const result = listUsersQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a limit above 100', () => {
    const result = listUsersQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });
});
