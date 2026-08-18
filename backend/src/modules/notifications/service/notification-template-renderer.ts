import { NotificationChannel } from '@prisma/client';
import { prisma } from '@config/database';
import { NotFoundError } from '@shared/errors';
import { NotificationTemplateRepository } from '../repository/notification-template.repository';

export interface RenderedNotificationTemplate {
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
}

const VARIABLE_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

/** `{{variable}}` substitution against a flat context object. An unmatched token is left as literal `{{var}}` in the output — a visible bug in the rendered message beats a silently blank field. */
function substitute(template: string, context: Record<string, unknown>): string {
  return template.replace(VARIABLE_PATTERN, (match, key: string) => {
    const value = context[key];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Template Renderer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Explicit constructor DI, explicit params, no `BaseService`/`Request`
 * coupling — same shape as `AuditLogRecorder`/`NotificationDispatchService`,
 * because this is called from two contexts with no request in common:
 * `NotificationDispatchService.send()` (when a caller passes `templateKey`)
 * and `workers/email.worker.ts` (no HTTP request at all). CRUD for template
 * *management* (create/update/delete/list) lives in the separate,
 * request-scoped `NotificationTemplateService` — this class only ever reads
 * and renders.
 *
 * Lookup order: this tenant's own override/custom row for `(key, channel)`,
 * falling back to the global system-default row — never the other way
 * around. Throws `NotFoundError` if neither exists, which
 * `workers/email.worker.ts` specifically catches to fall back further, to
 * the legacy in-memory `templates/index.ts` registry (kept as a safety net
 * for environments where the template seed hasn't run yet — see that
 * worker's own comment).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationTemplateRenderer {
  constructor(private readonly repository: NotificationTemplateRepository = new NotificationTemplateRepository(prisma)) {}

  async render(
    tenantId: string,
    key: string,
    channel: NotificationChannel,
    context: Record<string, unknown>,
  ): Promise<RenderedNotificationTemplate> {
    const override = await this.repository.findByKeyAndChannel(key, channel, { tenantId });
    const template = override ?? (await this.repository.findGlobalByKeyAndChannel(key, channel));

    if (!template || !template.isActive) {
      throw new NotFoundError(`No active notification template for key "${key}" on channel "${channel}".`);
    }

    return {
      subject: template.subjectTemplate ? substitute(template.subjectTemplate, context) : undefined,
      bodyText: substitute(template.bodyTemplateText, context),
      bodyHtml: template.bodyTemplateHtml ? substitute(template.bodyTemplateHtml, context) : undefined,
    };
  }
}
