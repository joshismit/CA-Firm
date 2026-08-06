import { Request } from 'express';
import { NotificationTemplate } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError } from '@shared/errors';
import { PaginationMeta } from '@shared/types';
import { ApiResponseHelper } from '@shared/response/api-response';
import { NotificationTemplateRepository } from '../repository/notification-template.repository';
import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  ListNotificationTemplatesQueryDto,
} from '../dto/notification-template.req.dto';

export interface NotificationTemplateWithOverrideFlag {
  template: NotificationTemplate;
  isOverridden: boolean;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Template Service (CRUD)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Management (create/update/delete/list/getById) for this tenant's own
 * `NotificationTemplate` override/custom rows — request-scoped, `BaseService`,
 * exactly like `TaskTemplateService`. Rendering (the `{{variable}}`
 * substitution other modules actually consume) lives in the separate,
 * request-independent `NotificationTemplateRenderer` — this class never
 * renders, it only manages the rows.
 *
 * A tenant can never create/update/delete a GLOBAL (`tenantId: null`) row —
 * every method here goes through `BaseRepository`'s normal tenant-scoped
 * path, which can't even see those rows. "Deleting" a tenant's own override
 * simply reverts that `(key, channel)` back to the global default on the
 * next render — there is nothing else to restore.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationTemplateService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: NotificationTemplateRepository = new NotificationTemplateRepository(prisma),
  ) {
    super(req);
  }

  /**
   * Merges this tenant's own override rows with the global defaults it
   * hasn't overridden yet, into one flat catalog — the shape the Template
   * Management screen actually needs (every key/channel combination that
   * exists, whichever version currently wins). Filtered/paginated in memory
   * since the total catalog size is small (dozens, not thousands) — a real
   * DB-level `OR` across two different `tenantId` predicates would be far
   * more complex for no real benefit at this scale.
   */
  async listCatalog(
    query: ListNotificationTemplatesQueryDto,
  ): Promise<{ data: NotificationTemplateWithOverrideFlag[]; meta: PaginationMeta }> {
    const [globals, overrides] = await Promise.all([
      this.repository.findGlobalDefaults(),
      this.repository.search({}, { page: 1, limit: 1000 }, { tenantId: this.tenantId }).then((r) => r.data),
    ]);

    const overrideByKeyChannel = new Map(overrides.map((row) => [`${row.key}:${row.channel}`, row]));
    const merged: NotificationTemplateWithOverrideFlag[] = globals.map((global) => {
      const override = overrideByKeyChannel.get(`${global.key}:${global.channel}`);
      return override ? { template: override, isOverridden: true } : { template: global, isOverridden: false };
    });

    // Tenant-only custom templates (no matching global key/channel at all).
    const globalKeys = new Set(globals.map((g) => `${g.key}:${g.channel}`));
    for (const override of overrides) {
      if (!globalKeys.has(`${override.key}:${override.channel}`)) {
        merged.push({ template: override, isOverridden: true });
      }
    }

    const filtered = merged.filter(({ template }) => {
      if (query.channel && template.channel !== query.channel) return false;
      if (query.isActive !== undefined && template.isActive !== query.isActive) return false;
      if (query.search) {
        const needle = query.search.toLowerCase();
        if (!template.name.toLowerCase().includes(needle) && !template.key.toLowerCase().includes(needle)) return false;
      }
      return true;
    });

    const page = query.page || 1;
    const limit = query.limit || 20;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return { data, meta: ApiResponseHelper.buildPaginationMeta(page, limit, filtered.length) };
  }

  async getTemplateById(id: string): Promise<NotificationTemplateWithOverrideFlag> {
    const own = await this.repository.findById(id, { tenantId: this.tenantId });
    if (own) return { template: own, isOverridden: true };

    const global = await this.repository.findFirst({ id, tenantId: null }, { ignoreTenant: true });
    this.validateExists(global, 'NotificationTemplate');
    return { template: global as NotificationTemplate, isOverridden: false };
  }

  async createTemplate(dto: CreateNotificationTemplateDto): Promise<NotificationTemplate> {
    const existing = await this.repository.findByKeyAndChannel(dto.key, dto.channel, { tenantId: this.tenantId });
    if (existing) {
      throw new ConflictError(`A template for key "${dto.key}" on channel "${dto.channel}" already exists for this tenant.`);
    }

    this.logger.info({ key: dto.key, channel: dto.channel }, 'Creating notification template override');

    return this.repository.create(
      {
        key: dto.key,
        channel: dto.channel,
        name: dto.name,
        description: dto.description ?? null,
        subjectTemplate: dto.subjectTemplate ?? null,
        bodyTemplateText: dto.bodyTemplateText,
        bodyTemplateHtml: dto.bodyTemplateHtml ?? null,
        isSystemDefault: false,
        createdBy: this.userId ?? null,
      },
      { tenantId: this.tenantId },
    );
  }

  async updateTemplate(id: string, dto: UpdateNotificationTemplateDto): Promise<NotificationTemplate> {
    const existing = await this.repository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'NotificationTemplate');

    this.logger.info({ templateId: id }, 'Updating notification template');

    return this.repository.update(id, dto, { tenantId: this.tenantId });
  }

  /** Reverts this tenant's override back to the global default — see this class's header comment. */
  async deleteTemplate(id: string): Promise<void> {
    const existing = await this.repository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'NotificationTemplate');

    this.logger.info({ templateId: id }, 'Deleting notification template override');

    await this.repository.delete(id, { tenantId: this.tenantId, userId: this.userId });
  }
}
