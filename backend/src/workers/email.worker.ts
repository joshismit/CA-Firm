import { Worker, Job } from 'bullmq';
import { NotFoundError } from '@shared/errors';
import { NotificationChannel } from '@prisma/client';
import { redis } from '@config/redis';
import { mailTransport, mailConfig } from '@config/mail';
import { logger } from '@config/logger';
import { QUEUE_NAMES } from '@config/queue';
import { renderTemplate } from '@modules/notifications/templates';
import { NotificationTemplateRenderer } from '@modules/notifications/service/notification-template-renderer';

interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  /** Optional — absent for any job enqueued before this field existed. When present, the DB-backed `NotificationTemplateRenderer` is tried first (see this file's header comment). */
  tenantId?: string;
  context: Record<string, unknown>;
}

const templateRenderer = new NotificationTemplateRenderer();

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Transactional Email Worker
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Consumes `QUEUE_NAMES.EMAIL` — the queue `UserService.queueInvitationEmail()`
 * has enqueued onto since the Users module was built, with no worker ever
 * having consumed it (see that method's header comment). This is that
 * worker: render the named template against `context`, then send through the
 * same `mailTransport` `EmailProvider` also uses.
 *
 * Deliberately separate from `notification.worker.ts` even though both send
 * email: this queue's jobs aren't `Notification` rows (an invitee isn't a
 * `User` yet, so there's no `userId` to attach one to) — this is a plain
 * transactional send, not a channel dispatch for an in-app-linked
 * notification.
 *
 * PRD §11.9 — tries the DB-backed `NotificationTemplateRenderer` first (so a
 * firm's own template override actually takes effect), falling back to the
 * legacy in-memory `renderTemplate()` registry only when the DB lookup finds
 * nothing (`NotFoundError` — the seed hasn't run yet in this environment) or
 * when the job has no `tenantId` at all (enqueued before this field existed).
 * The legacy registry is never deleted — it's this fallback's safety net.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createEmailWorker(): Worker<EmailJobData> {
  return new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJobData>) => {
      const { to, subject, template, tenantId, context } = job.data;
      const rendered = await renderEmail(template, tenantId, context);

      await mailTransport.sendMail({
        from: mailConfig.from,
        replyTo: mailConfig.defaults.replyTo,
        to,
        subject: rendered.subject ?? subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info({ to, template }, 'Transactional email sent');
    },
    { connection: redis },
  );
}

async function renderEmail(
  template: string,
  tenantId: string | undefined,
  context: Record<string, unknown>,
): Promise<{ subject?: string; html: string; text: string }> {
  if (tenantId) {
    try {
      const rendered = await templateRenderer.render(tenantId, template, NotificationChannel.EMAIL, context);
      return { subject: rendered.subject, html: rendered.bodyHtml ?? rendered.bodyText, text: rendered.bodyText };
    } catch (err) {
      if (!(err instanceof NotFoundError)) throw err;
      logger.warn({ template, tenantId }, 'No DB-backed notification template found — falling back to the legacy in-memory registry');
    }
  }

  return renderTemplate(template, context);
}
