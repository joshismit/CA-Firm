import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { notificationIdParamSchema, listNotificationsQuerySchema } from '@modules/notifications/schemas/notification.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Zod Schemas — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Exercises the schemas directly (`.safeParse()`), independent of Express/
 * `validate()` middleware. Mirrors `tests/unit/modules/roles/role.schema.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';

describe('notificationIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(notificationIdParamSchema.safeParse({ id: VALID_UUID_1 }).success).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    expect(notificationIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects a missing id', () => {
    expect(notificationIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('listNotificationsQuerySchema', () => {
  it('applies pagination defaults when nothing is provided', () => {
    const result = listNotificationsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
    }
  });

  it.each(Object.values(NotificationChannel))('accepts every valid channel filter (%s)', (channel) => {
    expect(listNotificationsQuerySchema.safeParse({ channel }).success).toBe(true);
  });

  it('rejects an invalid channel filter', () => {
    expect(listNotificationsQuerySchema.safeParse({ channel: 'CARRIER_PIGEON' }).success).toBe(false);
  });

  it.each(Object.values(NotificationStatus))('accepts every valid delivery status filter (%s)', (status) => {
    expect(listNotificationsQuerySchema.safeParse({ status }).success).toBe(true);
  });

  it('rejects an invalid status filter', () => {
    expect(listNotificationsQuerySchema.safeParse({ status: 'NOT_A_STATUS' }).success).toBe(false);
  });

  it('coerces unreadOnly=true from a query string', () => {
    const result = listNotificationsQuerySchema.safeParse({ unreadOnly: 'true' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unreadOnly).toBe(true);
  });

  it('leaves unreadOnly undefined when omitted (frontend only ever sends unreadOnly=true or omits it entirely)', () => {
    const result = listNotificationsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unreadOnly).toBeUndefined();
  });

  it('rejects a limit above 100', () => {
    expect(listNotificationsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
