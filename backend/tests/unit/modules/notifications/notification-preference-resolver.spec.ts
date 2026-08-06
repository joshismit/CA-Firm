/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: { tenant: { findUnique: jest.fn() } } }));

import { NotificationChannel } from '@prisma/client';
import { prisma } from '@config/database';
import { NotificationPreferenceResolver } from '@modules/notifications/service/notification-preference-resolver';
import { NotificationPreferenceRepository } from '@modules/notifications/repository/notification-preference.repository';
import { FirmNotificationSettingsRepository } from '@modules/notifications/repository/firm-notification-settings.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NotificationPreferenceResolver — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Every collaborator is mocked. Covers the check order (firm kill-switch →
 * user channel toggle → mute → quiet hours) and the quiet-hours reschedule
 * math specifically, since that's the only non-trivial computation in this
 * module.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

type MockedPreferenceRepository = { findByUserId: jest.Mock };
type MockedFirmSettingsRepository = { findByTenantId: jest.Mock };

function createResolver(
  preferenceRepo: MockedPreferenceRepository,
  firmSettingsRepo: MockedFirmSettingsRepository,
): NotificationPreferenceResolver {
  return new NotificationPreferenceResolver(
    preferenceRepo as unknown as NotificationPreferenceRepository,
    firmSettingsRepo as unknown as FirmNotificationSettingsRepository,
  );
}

beforeEach(() => {
  (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ timezone: 'Asia/Kolkata' }); // UTC+5:30
});

describe('NotificationPreferenceResolver', () => {
  it('allows when neither a firm-settings row nor a preference row exists (defaults)', async () => {
    const preferenceRepo = { findByUserId: jest.fn().mockResolvedValue(null) };
    const firmSettingsRepo = { findByTenantId: jest.fn().mockResolvedValue(null) };
    const resolver = createResolver(preferenceRepo, firmSettingsRepo);

    const decision = await resolver.resolve(TENANT_ID, USER_ID, NotificationChannel.EMAIL);

    expect(decision).toEqual({ allowed: true });
  });

  it('disallows (no reschedule) when the firm kill-switch disables the channel', async () => {
    const preferenceRepo = { findByUserId: jest.fn().mockResolvedValue(null) };
    const firmSettingsRepo = { findByTenantId: jest.fn().mockResolvedValue({ emailEnabled: false, smsEnabled: true, whatsappEnabled: true }) };
    const resolver = createResolver(preferenceRepo, firmSettingsRepo);

    const decision = await resolver.resolve(TENANT_ID, USER_ID, NotificationChannel.EMAIL);

    expect(decision).toEqual({ allowed: false });
  });

  it('disallows (no reschedule) when the user has disabled the channel', async () => {
    const preferenceRepo = {
      findByUserId: jest.fn().mockResolvedValue({
        emailEnabled: false,
        smsEnabled: true,
        whatsappEnabled: true,
        muteUntil: null,
        quietHoursStart: null,
        quietHoursEnd: null,
      }),
    };
    const firmSettingsRepo = { findByTenantId: jest.fn().mockResolvedValue(null) };
    const resolver = createResolver(preferenceRepo, firmSettingsRepo);

    const decision = await resolver.resolve(TENANT_ID, USER_ID, NotificationChannel.EMAIL);

    expect(decision).toEqual({ allowed: false });
  });

  it('disallows (no reschedule) while muteUntil is in the future', async () => {
    const preferenceRepo = {
      findByUserId: jest.fn().mockResolvedValue({
        emailEnabled: true,
        smsEnabled: true,
        whatsappEnabled: true,
        muteUntil: new Date(Date.now() + 60 * 60 * 1000),
        quietHoursStart: null,
        quietHoursEnd: null,
      }),
    };
    const firmSettingsRepo = { findByTenantId: jest.fn().mockResolvedValue(null) };
    const resolver = createResolver(preferenceRepo, firmSettingsRepo);

    const decision = await resolver.resolve(TENANT_ID, USER_ID, NotificationChannel.EMAIL);

    expect(decision).toEqual({ allowed: false });
  });

  it('allows once muteUntil is in the past', async () => {
    const preferenceRepo = {
      findByUserId: jest.fn().mockResolvedValue({
        emailEnabled: true,
        smsEnabled: true,
        whatsappEnabled: true,
        muteUntil: new Date(Date.now() - 60 * 60 * 1000),
        quietHoursStart: null,
        quietHoursEnd: null,
      }),
    };
    const firmSettingsRepo = { findByTenantId: jest.fn().mockResolvedValue(null) };
    const resolver = createResolver(preferenceRepo, firmSettingsRepo);

    const decision = await resolver.resolve(TENANT_ID, USER_ID, NotificationChannel.EMAIL);

    expect(decision).toEqual({ allowed: true });
  });

  describe('quiet hours (reschedule, not drop)', () => {
    it('disallows with a rescheduleFor when now falls inside a same-day window (e.g. 9-17)', async () => {
      const preferenceRepo = {
        findByUserId: jest.fn().mockResolvedValue({
          emailEnabled: true,
          smsEnabled: true,
          whatsappEnabled: true,
          muteUntil: null,
          quietHoursStart: 9,
          quietHoursEnd: 17,
        }),
      };
      const firmSettingsRepo = { findByTenantId: jest.fn().mockResolvedValue(null) };
      const resolver = createResolver(preferenceRepo, firmSettingsRepo);

      // 10:00 UTC = 15:30 IST — inside [9, 17).
      const now = new Date('2026-06-15T10:00:00.000Z');
      const decision = await resolver.resolve(TENANT_ID, USER_ID, NotificationChannel.EMAIL, now);

      expect(decision.allowed).toBe(false);
      expect(decision.rescheduleFor).toBeInstanceOf(Date);
    });

    it('allows outside a same-day window', async () => {
      const preferenceRepo = {
        findByUserId: jest.fn().mockResolvedValue({
          emailEnabled: true,
          smsEnabled: true,
          whatsappEnabled: true,
          muteUntil: null,
          quietHoursStart: 9,
          quietHoursEnd: 17,
        }),
      };
      const firmSettingsRepo = { findByTenantId: jest.fn().mockResolvedValue(null) };
      const resolver = createResolver(preferenceRepo, firmSettingsRepo);

      // 01:00 UTC = 06:30 IST — outside [9, 17).
      const now = new Date('2026-06-15T01:00:00.000Z');
      const decision = await resolver.resolve(TENANT_ID, USER_ID, NotificationChannel.EMAIL, now);

      expect(decision).toEqual({ allowed: true });
    });

    it('handles a wrap-past-midnight window (e.g. 22-6) correctly', async () => {
      const preferenceRepo = {
        findByUserId: jest.fn().mockResolvedValue({
          emailEnabled: true,
          smsEnabled: true,
          whatsappEnabled: true,
          muteUntil: null,
          quietHoursStart: 22,
          quietHoursEnd: 6,
        }),
      };
      const firmSettingsRepo = { findByTenantId: jest.fn().mockResolvedValue(null) };
      const resolver = createResolver(preferenceRepo, firmSettingsRepo);

      // 20:00 UTC = 01:30 IST (next day) — inside the wrapped [22, 6) window.
      const now = new Date('2026-06-15T20:00:00.000Z');
      const decision = await resolver.resolve(TENANT_ID, USER_ID, NotificationChannel.EMAIL, now);

      expect(decision.allowed).toBe(false);
      expect(decision.rescheduleFor).toBeInstanceOf(Date);
      // The reschedule target must be strictly after `now`.
      expect((decision.rescheduleFor as Date).getTime()).toBeGreaterThan(now.getTime());
    });

    it('treats quietHoursStart === quietHoursEnd as "no quiet hours configured" (never blocks)', async () => {
      const preferenceRepo = {
        findByUserId: jest.fn().mockResolvedValue({
          emailEnabled: true,
          smsEnabled: true,
          whatsappEnabled: true,
          muteUntil: null,
          quietHoursStart: 9,
          quietHoursEnd: 9,
        }),
      };
      const firmSettingsRepo = { findByTenantId: jest.fn().mockResolvedValue(null) };
      const resolver = createResolver(preferenceRepo, firmSettingsRepo);

      const decision = await resolver.resolve(TENANT_ID, USER_ID, NotificationChannel.EMAIL, new Date('2026-06-15T09:00:00.000Z'));

      expect(decision).toEqual({ allowed: true });
    });
  });
});
