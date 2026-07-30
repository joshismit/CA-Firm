import { roleIdParamSchema, updatePermissionMatrixSchema } from '@modules/permissions/schemas/permission.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Permission Zod Schemas — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the schemas directly (`.safeParse()`), independent of Express/
 * `validate()` middleware — pure input → success/failure assertions. Mirrors
 * `tests/unit/modules/roles/role.schema.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222';

describe('roleIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(roleIdParamSchema.safeParse({ roleId: VALID_UUID_1 }).success).toBe(true);
  });

  it('rejects a non-UUID roleId', () => {
    expect(roleIdParamSchema.safeParse({ roleId: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects a missing roleId', () => {
    expect(roleIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('updatePermissionMatrixSchema', () => {
  it('accepts a valid payload with granted: true', () => {
    const result = updatePermissionMatrixSchema.safeParse({ roleId: VALID_UUID_1, permissionId: VALID_UUID_2, granted: true });
    expect(result.success).toBe(true);
  });

  it('accepts a valid payload with granted: false', () => {
    const result = updatePermissionMatrixSchema.safeParse({ roleId: VALID_UUID_1, permissionId: VALID_UUID_2, granted: false });
    expect(result.success).toBe(true);
  });

  it('rejects a missing roleId', () => {
    const result = updatePermissionMatrixSchema.safeParse({ permissionId: VALID_UUID_2, granted: true });
    expect(result.success).toBe(false);
  });

  it('rejects a missing permissionId', () => {
    const result = updatePermissionMatrixSchema.safeParse({ roleId: VALID_UUID_1, granted: true });
    expect(result.success).toBe(false);
  });

  it('rejects a missing granted', () => {
    const result = updatePermissionMatrixSchema.safeParse({ roleId: VALID_UUID_1, permissionId: VALID_UUID_2 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-boolean granted', () => {
    const result = updatePermissionMatrixSchema.safeParse({ roleId: VALID_UUID_1, permissionId: VALID_UUID_2, granted: 'yes' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID roleId', () => {
    const result = updatePermissionMatrixSchema.safeParse({ roleId: 'not-a-uuid', permissionId: VALID_UUID_2, granted: true });
    expect(result.success).toBe(false);
  });
});
