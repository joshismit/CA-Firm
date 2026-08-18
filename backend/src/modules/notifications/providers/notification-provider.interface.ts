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

/** PRD §11.2 — every provider's fixed, non-network-dependent shape; does not vary by tenant/env. */
export interface NotificationProviderCapabilities {
  supportsRichText: boolean;
  supportsAttachments: boolean;
  /** `null` = no practical limit enforced by this provider. */
  maxMessageLength: number | null;
}

/** PRD §11.16 — backs `GET /notification-providers/health`. */
export interface NotificationProviderHealth {
  status: 'up' | 'down' | 'unconfigured';
  checkedAt: string;
  latencyMs?: number;
  detail?: string;
}

export interface NotificationProvider {
  /** False when the required credentials for this channel aren't set — `send()` short-circuits rather than attempting a network call. */
  readonly isConfigured: boolean;
  send(payload: NotificationSendPayload): Promise<NotificationSendResult>;
  /** Configuration-only check — never makes a network call. `reason` is set only when `valid` is false. */
  validate(): Promise<{ valid: boolean; reason?: string }>;
  /** May make a network call for providers where a genuine one exists (e.g. Email's SMTP `verify()`) — see each implementation's own comment. */
  health(): Promise<NotificationProviderHealth>;
  getCapabilities(): NotificationProviderCapabilities;
}
