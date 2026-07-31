/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Provider Interface (PRD §11.4 — "provider-based and configurable")
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One interface per delivery channel (Email/WhatsApp/SMS), so the dispatch
 * service and worker never know which concrete vendor is behind a channel —
 * swapping WhatsApp from Meta Cloud API to Twilio, for instance, means
 * writing a new class that implements this interface, not touching the
 * dispatch/worker layer at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface NotificationSendPayload {
  /** Recipient email address (Email) or phone number in E.164-ish form (WhatsApp/SMS). */
  to: string;
  subject: string;
  message: string;
}

export interface NotificationSendResult {
  success: boolean;
  /** The vendor's own message/delivery ID, when available — not stored yet (`Notification` has no column for it), kept for when a provider is actually wired up and this becomes worth persisting. */
  providerMessageId?: string;
  /** Present only when `success` is false — surfaced to logs/`Notification.status`, never thrown as an exception (a failed send is an expected outcome, not a bug). */
  error?: string;
}

export interface NotificationProvider {
  /** False when the required credentials for this channel aren't set — `send()` short-circuits rather than attempting a network call. */
  readonly isConfigured: boolean;
  send(payload: NotificationSendPayload): Promise<NotificationSendResult>;
}
