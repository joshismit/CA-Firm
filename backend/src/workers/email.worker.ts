import { Worker, Job } from 'bullmq';
import { redis } from '@config/redis';
import { mailTransport, mailConfig } from '@config/mail';
import { logger } from '@config/logger';
import { QUEUE_NAMES } from '@config/queue';
import { renderTemplate } from '@modules/notifications/templates';

interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

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
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createEmailWorker(): Worker<EmailJobData> {
  return new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJobData>) => {
      const { to, subject, template, context } = job.data;
      const rendered = renderTemplate(template, context);

      await mailTransport.sendMail({
        from: mailConfig.from,
        replyTo: mailConfig.defaults.replyTo,
        to,
        subject,
        html: rendered.html,
        text: rendered.text,
      });

      logger.info({ to, template }, 'Transactional email sent');
    },
    { connection: redis },
  );
}
