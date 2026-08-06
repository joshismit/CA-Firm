import { NotificationChannel } from '@prisma/client';
import { NotificationProvider } from './notification-provider.interface';
import { EmailProvider } from './email.provider';
import { WhatsAppProvider } from './whatsapp.provider';
import { SmsProvider } from './sms.provider';

export * from './notification-provider.interface';
export { EmailProvider } from './email.provider';
export { WhatsAppProvider } from './whatsapp.provider';
export { SmsProvider } from './sms.provider';

const emailProvider = new EmailProvider();
const whatsAppProvider = new WhatsAppProvider();
const smsProvider = new SmsProvider();

/**
 * Resolves the concrete provider for a channel. `IN_APP` has no provider —
 * it's a plain DB row, never dispatched through this layer (see
 * `NotificationDispatchService`'s header comment).
 */
export function resolveProvider(channel: Exclude<NotificationChannel, 'IN_APP'>): NotificationProvider {
  switch (channel) {
    case NotificationChannel.EMAIL:
      return emailProvider;
    case NotificationChannel.WHATSAPP:
      return whatsAppProvider;
    case NotificationChannel.SMS:
      return smsProvider;
  }
}

/** PRD §11.16 — every dispatchable channel's provider, for `GET /notification-providers`(`/health`) to iterate. `IN_APP` is omitted — it has no provider, see `resolveProvider()`'s comment. */
export function getAllProviders(): Record<Exclude<NotificationChannel, 'IN_APP'>, NotificationProvider> {
  return {
    [NotificationChannel.EMAIL]: emailProvider,
    [NotificationChannel.WHATSAPP]: whatsAppProvider,
    [NotificationChannel.SMS]: smsProvider,
  };
}
