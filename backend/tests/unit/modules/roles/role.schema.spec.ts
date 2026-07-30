import { RoleType } from '@prisma/client';
import { createRoleSchema, updateRoleSchema, listRolesQuerySchema, roleIdParamSchema, assignRoleSchema } from '@modules/roles/schemas/role.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Role Zod Schemas — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the schemas directly (`.safeParse()`), independent of Express/
 * `validate()` middleware — pure input → success/failure assertions. Mirrors
 * `tests/unit/modules/users/user.schema.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';

describe('createRoleSchema', () => {
  it('accepts the minimal valid payload (name + permissionCodes only)', () => {
    const result = createRoleSchema.safeParse({ name: 'Staff', permissionCodes: ['users:read'] });
    expect(result.success).toBe(true);
  });

  it('accepts a fully-populated valid payload', () => {
    const result = createRoleSchema.safeParse({
      name: 'Staff',
      description: 'Standard staff access',
      color: '#6366F1',
      permissionCodes: ['users:read', 'users:manage'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing name', () => {
    const result = createRoleSchema.safeParse({ permissionCodes: ['users:read'] });
    expect(result.success).toBe(false);
  });

  it('rejects a name shorter than 2 characters', () => {
    const result = createRoleSchema.safeParse({ name: 'A', permissionCodes: ['users:read'] });
    expect(result.success).toBe(false);
  });

  it('rejects a name longer than 100 characters', () => {
    const result = createRoleSchema.safeParse({ name: 'A'.repeat(101), permissionCodes: ['users:read'] });
    expect(result.success).toBe(false);
  });

  it('rejects an empty permissionCodes array', () => {
    const result = createRoleSchema.safeParse({ name: 'Staff', permissionCodes: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a missing permissionCodes', () => {
    const result = createRoleSchema.safeParse({ name: 'Staff' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid hex color', () => {
    const result = createRoleSchema.safeParse({ name: 'Staff', color: 'blue', permissionCodes: ['users:read'] });
    expect(result.success).toBe(false);
  });

  it('accepts a valid hex color', () => {
    const result = createRoleSchema.safeParse({ name: 'Staff', color: '#ABCDEF', permissionCodes: ['users:read'] });
    expect(result.success).toBe(true);
  });

  it('rejects description longer than 500 characters', () => {
    const result = createRoleSchema.safeParse({
      name: 'Staff',
      description: 'A'.repeat(501),
      permissionCodes: ['users:read'],
    });
    expect(result.success).toBe(false);
  });
});

describe('updateRoleSchema', () => {
  it('accepts an empty object (every field optional)', () => {
    expect(updateRoleSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid partial update', () => {
    const result = updateRoleSchema.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty permissionCodes array when provided (still >= 1 under partial())', () => {
    const result = updateRoleSchema.safeParse({ permissionCodes: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a name shorter than 2 characters when provided', () => {
    const result = updateRoleSchema.safeParse({ name: 'A' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid permissionCodes replacement', () => {
    const result = updateRoleSchema.safeParse({ permissionCodes: ['roles:read'] });
    expect(result.success).toBe(true);
  });
});

describe('roleIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(roleIdParamSchema.safeParse({ id: VALID_UUID_1 }).success).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    expect(roleIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('listRolesQuerySchema', () => {
  it('applies pagination defaults when nothing is provided', () => {
    const result = listRolesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
    }
  });

  it.each(Object.values(RoleType))('accepts every valid RoleType filter value (%s)', (type) => {
    expect(listRolesQuerySchema.safeParse({ type }).success).toBe(true);
  });

  it('rejects an invalid type filter', () => {
    expect(listRolesQuerySchema.safeParse({ type: 'NOT_A_TYPE' }).success).toBe(false);
  });
});

describe('assignRoleSchema', () => {
  it('accepts the minimal valid payload (userId + roleId)', () => {
    expect(assignRoleSchema.safeParse({ userId: VALID_UUID_1, roleId: VALID_UUID_1 }).success).toBe(true);
  });

  it('accepts an optional expiresAt', () => {
    expect(assignRoleSchema.safeParse({ userId: VALID_UUID_1, roleId: VALID_UUID_1, expiresAt: '2027-01-01T00:00:00.000Z' }).success).toBe(true);
  });

  it('rejects a missing userId', () => {
    expect(assignRoleSchema.safeParse({ roleId: VALID_UUID_1 }).success).toBe(false);
  });

  it('rejects a missing roleId', () => {
    expect(assignRoleSchema.safeParse({ userId: VALID_UUID_1 }).success).toBe(false);
  });

  it('rejects a non-UUID userId', () => {
    expect(assignRoleSchema.safeParse({ userId: 'not-a-uuid', roleId: VALID_UUID_1 }).success).toBe(false);
  });
});
