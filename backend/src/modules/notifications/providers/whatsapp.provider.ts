import { env } from '@config/environment';
import { logger } from '@config/logger';
import { NotificationProvider, NotificationSendPayload, NotificationSendResult } from './notification-provider.interface';

/**
 * WhatsApp provider (PRD §11.1). No real WhatsApp Business API account exists
 * for this platform yet, so this is a generic "POST a bearer-token request to
 * a configurable URL" shape rather than a specific vendor SDK (Meta Cloud
 * API/Twilio/Gupshup all differ in exact payload shape) — wiring a real
 * vendor later means adjusting the request body in `send()`, not the
 * `NotificationProvider` contract or anything that calls it.
 *
 * `isConfigured` is false whenever `WHATSAPP_API_URL`/`WHATSAPP_API_TOKEN`
 * are unset (the default in every environment right now) — `send()`
 * short-circuits with a clear, honest failure rather than attempting (and
 * hanging on) a request to nowhere.
 */
export class WhatsAppProvider implements NotificationProvider {
  readonly isConfigured = Boolean(env.WHATSAPP_API_URL && env.WHATSAPP_API_TOKEN);

  async send(payload: NotificationSendPayload): Promise<NotificationSendResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'WhatsApp is not configured for this platform yet.' };
    }

    try {
      const response = await fetch(env.WHATSAPP_API_URL as string, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.WHATSAPP_SENDER_ID,
          to: payload.to,
          message: payload.message,
        }),
      });

      if (!response.ok) {
        return { success: false, error: `WhatsApp provider responded with ${response.status}` };
      }

      const body = (await response.json().catch(() => ({}))) as { id?: string };
      return { success: true, providerMessageId: body.id };
    } catch (err) {
      logger.error({ err, to: payload.to }, 'WhatsApp send failed');
      return { success: false, error: err instanceof Error ? err.message : 'Unknown WhatsApp delivery error' };
    }
  }
}
