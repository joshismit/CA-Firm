/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Email Template Registry
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Renders the `template`/`context` pair already carried on every `emailQueue`
 * job (see `UserService.queueInvitationEmail()`/`AuthService.queuePasswordResetEmail()`
 * — `subject` is computed by the caller and sent as-is, this registry only
 * renders the body). Plain template functions rather than a templating
 * engine/file-based views — a real engine (Handlebars/MJML) is worth adding
 * once there are enough of these to justify one, not before.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface RenderedEmail {
  html: string;
  text: string;
}

export interface UserInvitationContext {
  firstName: string | null;
  acceptUrl: string;
  expiresAt: string;
}

export interface PasswordResetContext {
  firstName: string;
  resetUrl: string;
  expiresAt: string;
}

const TEMPLATES: Record<string, (context: Record<string, unknown>) => RenderedEmail> = {
  'user-invitation': (context) => {
    const { firstName, acceptUrl, expiresAt } = context as unknown as UserInvitationContext;
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
    const expiresLabel = new Date(expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    return {
      text: `${greeting}\n\nYou've been invited to join the team. Accept your invitation here:\n${acceptUrl}\n\nThis link expires on ${expiresLabel}.`,
      html: `
        <p>${greeting}</p>
        <p>You've been invited to join the team.</p>
        <p><a href="${acceptUrl}">Accept your invitation</a></p>
        <p style="color:#6b7280;font-size:12px;">This link expires on ${expiresLabel}.</p>
      `.trim(),
    };
  },
  'password-reset': (context) => {
    const { firstName, resetUrl, expiresAt } = context as unknown as PasswordResetContext;
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
    const expiresLabel = new Date(expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    return {
      text: `${greeting}\n\nWe received a request to reset your password. Reset it here:\n${resetUrl}\n\nThis link expires on ${expiresLabel}. If you didn't request this, you can safely ignore this email.`,
      html: `
        <p>${greeting}</p>
        <p>We received a request to reset your password.</p>
        <p><a href="${resetUrl}">Reset your password</a></p>
        <p style="color:#6b7280;font-size:12px;">This link expires on ${expiresLabel}. If you didn't request this, you can safely ignore this email.</p>
      `.trim(),
    };
  },
};

/** Throws for an unregistered template name — a job referencing one is a programmer error, not a runtime condition to degrade gracefully from. */
export function renderTemplate(template: string, context: Record<string, unknown>): RenderedEmail {
  const renderer = TEMPLATES[template];
  if (!renderer) {
    throw new Error(`Unknown email template: "${template}"`);
  }
  return renderer(context);
}
