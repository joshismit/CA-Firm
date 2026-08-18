import { env } from '@config/environment';
import { logger } from '@config/logger';
import {
  NotificationProvider,
  NotificationProviderCapabilities,
  NotificationProviderHealth,
  NotificationSendPayload,
  NotificationSendResult,
} from './notification-provider.interface';

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

  async validate(): Promise<{ valid: boolean; reason?: string }> {
    return this.isConfigured ? { valid: true } : { valid: false, reason: 'SMS_API_URL/SMS_API_KEY are not set.' };
  }

  /**
   * Deliberately configuration-based only — never a live network probe. The only generic
   * operation available on an arbitrary configurable REST endpoint is the send operation
   * itself, and probing it would mean actually sending a message. This mirrors the Phase 1
   * scoping decision to keep this provider a vendor-agnostic shell rather than a real SDK.
   */
  async health(): Promise<NotificationProviderHealth> {
    return { status: this.isConfigured ? 'up' : 'unconfigured', checkedAt: new Date().toISOString() };
  }

  getCapabilities(): NotificationProviderCapabilities {
    return { supportsRichText: false, supportsAttachments: false, maxMessageLength: 1600 };
  }
}
