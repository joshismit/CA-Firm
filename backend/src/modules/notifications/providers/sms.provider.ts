import { env } from '@config/environment';
import { logger } from '@config/logger';
import { NotificationProvider, NotificationSendPayload, NotificationSendResult } from './notification-provider.interface';

/**
 * SMS provider (PRD §11.3 — "configurable provider-based option, cost borne
 * by the firm"). Same generic, vendor-agnostic shape as `WhatsAppProvider`
 * (see its header comment) — no real SMS account exists for this platform
 * yet, so `isConfigured` is false by default and `send()` short-circuits
 * rather than attempting a request to nowhere.
 */
export class SmsProvider implements NotificationProvider {
  readonly isConfigured = Boolean(env.SMS_API_URL && env.SMS_API_KEY);

  async send(payload: NotificationSendPayload): Promise<NotificationSendResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'SMS is not configured for this firm yet.' };
    }

    try {
      const response = await fetch(env.SMS_API_URL as string, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SMS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: env.SMS_SENDER_ID,
          to: payload.to,
          message: payload.message,
        }),
      });

      if (!response.ok) {
        return { success: false, error: `SMS provider responded with ${response.status}` };
      }

      const body = (await response.json().catch(() => ({}))) as { id?: string };
      return { success: true, providerMessageId: body.id };
    } catch (err) {
      logger.error({ err, to: payload.to }, 'SMS send failed');
      return { success: false, error: err instanceof Error ? err.message : 'Unknown SMS delivery error' };
    }
  }
}
