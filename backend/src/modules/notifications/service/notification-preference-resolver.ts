import { NotificationChannel } from '@prisma/client';
import { prisma } from '@config/database';
import { NotificationPreferenceRepository } from '../repository/notification-preference.repository';
import { FirmNotificationSettingsRepository } from '../repository/firm-notification-settings.repository';

export interface ChannelDecision {
  allowed: boolean;
  /** Set only when `allowed` is false because of quiet hours — the caller should reschedule for this time instead of dropping the send. Unset for every other reason to skip (firm kill-switch, user preference off, muted). */
  rescheduleFor?: Date;
}

function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - date.getTime()) / 60000;
}

function getLocalHour(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit' }).format(date);
  return Number(hour);
}

/** Wraps past midnight when `start > end` (e.g. 22 → 6 means "quiet from 10pm to 6am"). `start === end` is treated as "no quiet hours configured" rather than "quiet all day," to avoid an easy misconfiguration silently blocking every send. */
function isWithinQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/**
 * Next occurrence of `endHour` (tenant-local) at or after `now`, converted
 * back to a UTC `Date`. Assumes the timezone's UTC offset stays constant
 * across the reschedule window (at most ~24h) — a known Phase 1 limitation
 * that only matters if the window straddles an actual DST transition, which
 * this deliberately doesn't handle (no timezone-database dependency exists
 * in this codebase yet to do it precisely).
 */
function computeQuietHoursEnd(now: Date, timeZone: string, endHour: number): Date {
  const offsetMinutes = getTimezoneOffsetMinutes(now, timeZone);
  const localNow = new Date(now.getTime() + offsetMinutes * 60000);
  let localTarget = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), endHour, 0, 0));
  if (localTarget <= localNow) {
    localTarget = new Date(localTarget.getTime() + 24 * 60 * 60 * 1000);
  }
  return new Date(localTarget.getTime() - offsetMinutes * 60000);
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Preference Resolver
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Called once per non-`IN_APP` channel by `NotificationDispatchService.send()`
 * before a `Notification` row is created — never for `IN_APP`, which is
 * never preference-filtered (security-relevant system notices must not be
 * silently suppressible by the affected user's own preference row).
 *
 * Check order: firm-wide kill-switch (`FirmNotificationSettings`) → this
 * user's own channel toggle (`NotificationPreference`) → `muteUntil` (skip,
 * no reschedule) → quiet hours (RESCHEDULE, don't drop — the message still
 * matters, it just shouldn't land at 2am).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationPreferenceResolver {
  constructor(
    private readonly preferenceRepository: NotificationPreferenceRepository = new NotificationPreferenceRepository(prisma),
    private readonly firmSettingsRepository: FirmNotificationSettingsRepository = new FirmNotificationSettingsRepository(prisma),
  ) {}

  async resolve(tenantId: string, userId: string, channel: NotificationChannel, now: Date = new Date()): Promise<ChannelDecision> {
    const [firmSettings, preference, tenant] = await Promise.all([
      this.firmSettingsRepository.findByTenantId(tenantId),
      this.preferenceRepository.findByUserId(userId),
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }),
    ]);

    if (firmSettings && !this.isChannelEnabled(firmSettings, channel)) {
      return { allowed: false };
    }

    if (preference) {
      if (!this.isChannelEnabled(preference, channel)) {
        return { allowed: false };
      }
      if (preference.muteUntil && preference.muteUntil > now) {
        return { allowed: false };
      }
      if (preference.quietHoursStart !== null && preference.quietHoursEnd !== null) {
        const timeZone = tenant?.timezone ?? 'Asia/Kolkata';
        const localHour = getLocalHour(now, timeZone);
        if (isWithinQuietHours(localHour, preference.quietHoursStart, preference.quietHoursEnd)) {
          return { allowed: false, rescheduleFor: computeQuietHoursEnd(now, timeZone, preference.quietHoursEnd) };
        }
      }
    }

    return { allowed: true };
  }

  private isChannelEnabled(
    settings: { emailEnabled: boolean; smsEnabled: boolean; whatsappEnabled: boolean },
    channel: NotificationChannel,
  ): boolean {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return settings.emailEnabled;
      case NotificationChannel.SMS:
        return settings.smsEnabled;
      case NotificationChannel.WHATSAPP:
        return settings.whatsappEnabled;
      case NotificationChannel.IN_APP:
        return true;
    }
  }
}
