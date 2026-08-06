import { mailTransport, mailConfig } from '@config/mail';
import { logger } from '@config/logger';
import {
  NotificationProvider,
  NotificationProviderCapabilities,
  NotificationProviderHealth,
  NotificationSendPayload,
  NotificationSendResult,
} from './notification-provider.interface';

/**
 * Real Email provider — wraps the existing `mailTransport` (nodemailer),
 * configured entirely via `MAIL_*` env vars (`@config/mail`). Unlike
 * WhatsApp/SMS, there is no "not configured" state: `MAIL_HOST` always has a
 * default, so the transport object always exists — a bad/unreachable SMTP
 * host is a runtime send failure (caught below), not a design-time guard.
 */
export class EmailProvider implements NotificationProvider {
  readonly isConfigured = true;

  async send(payload: NotificationSendPayload): Promise<NotificationSendResult> {
    try {
      const info = await mailTransport.sendMail({
        from: mailConfig.from,
        replyTo: mailConfig.defaults.replyTo,
        to: payload.to,
        subject: payload.subject,
        text: payload.message,
      });
      return { success: true, providerMessageId: info.messageId };
    } catch (err) {
      logger.error({ err, to: payload.to }, 'Email send failed');
      return { success: false, error: err instanceof Error ? err.message : 'Unknown email delivery error' };
    }
  }

  async validate(): Promise<{ valid: boolean; reason?: string }> {
    return { valid: true };
  }

  /** Email is the one provider where a real, meaningful health check exists — `mailTransport.verify()` actually opens a connection to the configured SMTP host. */
  async health(): Promise<NotificationProviderHealth> {
    const checkedAt = new Date().toISOString();
    const startedAt = Date.now();
    try {
      await mailTransport.verify();
      return { status: 'up', checkedAt, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return {
        status: 'down',
        checkedAt,
        latencyMs: Date.now() - startedAt,
        detail: err instanceof Error ? err.message : 'SMTP verification failed',
      };
    }
  }

  getCapabilities(): NotificationProviderCapabilities {
    return { supportsRichText: true, supportsAttachments: false, maxMessageLength: null };
  }
}
