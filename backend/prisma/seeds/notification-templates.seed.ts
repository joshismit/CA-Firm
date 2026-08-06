import { PrismaClient, NotificationChannel } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Template Seed — Global Defaults
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Seeds the global (`tenantId: null`) system-default `NotificationTemplate`
 * rows every tenant falls back to. `user-invitation`/`password-reset` are
 * ported verbatim from `modules/notifications/templates/index.ts`'s existing
 * in-memory registry — that registry is NOT deleted (it stays as
 * `workers/email.worker.ts`'s fallback if this seed hasn't run yet in some
 * environment, see that worker's own comment).
 *
 * Idempotent — upserts on `(tenantId, key, channel)`, safe to re-run.
 * ─────────────────────────────────────────────────────────────────────────────
 */
interface GlobalTemplateSeed {
  key: string;
  channel: NotificationChannel;
  name: string;
  description: string;
  subjectTemplate?: string;
  bodyTemplateText: string;
  bodyTemplateHtml?: string;
}

const GLOBAL_TEMPLATES: GlobalTemplateSeed[] = [
  {
    key: 'user-invitation',
    channel: NotificationChannel.EMAIL,
    name: 'User Invitation',
    description: 'Sent when a staff member is invited to join the firm.',
    subjectTemplate: "You've been invited to join {{firmName}}",
    bodyTemplateText:
      "Hi {{firstName}},\n\nYou've been invited to join the team. Accept your invitation here:\n{{acceptUrl}}\n\nThis link expires on {{expiresAt}}.",
    bodyTemplateHtml: `
      <p>Hi {{firstName}},</p>
      <p>You've been invited to join the team.</p>
      <p><a href="{{acceptUrl}}">Accept your invitation</a></p>
      <p style="color:#6b7280;font-size:12px;">This link expires on {{expiresAt}}.</p>
    `.trim(),
  },
  {
    key: 'password-reset',
    channel: NotificationChannel.EMAIL,
    name: 'Password Reset',
    description: 'Sent when a user requests a password reset.',
    subjectTemplate: 'Reset your password',
    bodyTemplateText:
      "Hi {{firstName}},\n\nWe received a request to reset your password. Reset it here:\n{{resetUrl}}\n\nThis link expires on {{expiresAt}}. If you didn't request this, you can safely ignore this email.",
    bodyTemplateHtml: `
      <p>Hi {{firstName}},</p>
      <p>We received a request to reset your password.</p>
      <p><a href="{{resetUrl}}">Reset your password</a></p>
      <p style="color:#6b7280;font-size:12px;">This link expires on {{expiresAt}}. If you didn't request this, you can safely ignore this email.</p>
    `.trim(),
  },
];

export async function seedNotificationTemplates(prisma: PrismaClient): Promise<void> {
  for (const template of GLOBAL_TEMPLATES) {
    // `tenantId: null` has no unique-constraint shorthand in Prisma's `upsert.where` for a
    // composite key containing a nullable column, so this looks the row up manually first.
    // eslint-disable-next-line no-await-in-loop -- a handful of rows, seed-time only.
    const existing = await prisma.notificationTemplate.findFirst({
      where: { tenantId: null, key: template.key, channel: template.channel },
    });

    const data = {
      name: template.name,
      description: template.description,
      subjectTemplate: template.subjectTemplate ?? null,
      bodyTemplateText: template.bodyTemplateText,
      bodyTemplateHtml: template.bodyTemplateHtml ?? null,
      isActive: true,
      isSystemDefault: true,
    };

    if (existing) {
      // eslint-disable-next-line no-await-in-loop -- see above.
      await prisma.notificationTemplate.update({ where: { id: existing.id }, data });
    } else {
      // eslint-disable-next-line no-await-in-loop -- see above.
      await prisma.notificationTemplate.create({
        data: { tenantId: null, key: template.key, channel: template.channel, ...data },
      });
    }
  }
}
