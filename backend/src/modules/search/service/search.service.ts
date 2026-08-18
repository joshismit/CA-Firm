import { Request } from 'express';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { PermissionAction, PermissionResource } from '@shared/enums';
import { RequestUser } from '@shared/types';
import { BusinessRepository } from '@modules/business/repository/business.repository';
import { ContactRepository } from '@modules/contacts/repository/contact.repository';
import { LeadRepository } from '@modules/crm/repository/lead.repository';
import { DocumentRepository } from '@modules/documents/repository/document.repository';
import { DocumentAccessScopeService } from '@modules/documents/service/document-access-scope.service';
import { TaskRepository } from '@modules/tasks/repository/task.repository';
import { SearchResultItemDto, SearchResultsResponseDto } from '../dto/search.res.dto';
import { toBusinessSearchResult, toContactSearchResult, toDocumentSearchResult, toLeadSearchResult, toTaskSearchResult } from '../mapper/search.mapper';

/** Reuses each resource's own pre-existing `:read` permission — no new permission resource for Search (see this class's header comment). */
const BUSINESS_READ = `${PermissionResource.BUSINESS}:${PermissionAction.READ}`;
const CONTACTS_READ = `${PermissionResource.CONTACTS}:${PermissionAction.READ}`;
const CRM_READ = `${PermissionResource.CRM}:${PermissionAction.READ}`;
const DOCUMENTS_READ = `${PermissionResource.DOCUMENTS}:${PermissionAction.READ}`;
const TASKS_READ = `${PermissionResource.TASKS}:${PermissionAction.READ}`;

const EMPTY_RESULTS: Promise<SearchResultItemDto[]> = Promise.resolve([]);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Search Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PRD §13.1 — fans out to each source module's own `findForGlobalSearch()`
 * finder in parallel (mirrors `ReportService.getDashboardPerformanceSummary`'s
 * own parallel-fan-out style) and assembles the grouped response.
 *
 * Resolved decision (see this feature's plan): Global Search visibility
 * matches each category's *existing list page* exactly, rather than
 * inventing new assignment-based row scoping the list pages themselves don't
 * have. Concretely: a category is silently omitted (empty array, never a
 * 403) unless the caller holds that resource's own pre-existing `:read`
 * permission — the identical gate each list page's route already uses via
 * `requirePermission()`. Documents is the one exception, because it's the
 * one category where the equivalent list page *does* have real per-record
 * scoping: `DocumentAccessScopeService`, reused here unmodified.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class SearchService extends BaseService {
  constructor(
    req: Request,
    private readonly businessRepository: BusinessRepository = new BusinessRepository(prisma),
    private readonly contactRepository: ContactRepository = new ContactRepository(prisma),
    private readonly leadRepository: LeadRepository = new LeadRepository(prisma),
    private readonly documentRepository: DocumentRepository = new DocumentRepository(prisma),
    private readonly taskRepository: TaskRepository = new TaskRepository(prisma),
    private readonly documentAccessScopeService: DocumentAccessScopeService = new DocumentAccessScopeService(),
  ) {
    super(req);
  }

  async search(q: string, limit: number): Promise<SearchResultsResponseDto> {
    const options = { tenantId: this.tenantId as string };
    const permissions = this.req.user?.permissions ?? [];

    const [businesses, contacts, leads, documents, tasks] = await Promise.all([
      permissions.includes(BUSINESS_READ)
        ? this.businessRepository.findForGlobalSearch(q, limit, options).then((rows) => rows.map((row) => toBusinessSearchResult(row, q)))
        : EMPTY_RESULTS,
      permissions.includes(CONTACTS_READ)
        ? this.contactRepository.findForGlobalSearch(q, limit, options).then((rows) => rows.map((row) => toContactSearchResult(row, q)))
        : EMPTY_RESULTS,
      permissions.includes(CRM_READ)
        ? this.leadRepository.findForGlobalSearch(q, limit, options).then((rows) => rows.map((row) => toLeadSearchResult(row, q)))
        : EMPTY_RESULTS,
      permissions.includes(DOCUMENTS_READ) ? this.searchDocuments(q, limit, options) : EMPTY_RESULTS,
      permissions.includes(TASKS_READ)
        ? this.taskRepository.findForGlobalSearch(q, limit, options).then((rows) => rows.map((row) => toTaskSearchResult(row)))
        : EMPTY_RESULTS,
    ]);

    this.logger.info(
      { q, businesses: businesses.length, contacts: contacts.length, leads: leads.length, documents: documents.length, tasks: tasks.length },
      'Global search executed',
    );

    return { businesses, contacts, leads, documents, tasks };
  }

  /** Documents' own list page resolves its access scope once per request via `DocumentAccessScopeService` and ANDs it onto every read — reused here unmodified rather than reinvented. */
  private async searchDocuments(q: string, limit: number, options: { tenantId: string }): Promise<SearchResultItemDto[]> {
    const scope = await this.documentAccessScopeService.resolve(this.req.user as RequestUser);
    const scopeWhere = DocumentAccessScopeService.toWhereInput(scope);
    const documents = await this.documentRepository.findForGlobalSearch(q, limit, options, scopeWhere);
    return documents.map((document) => toDocumentSearchResult(document));
  }
}
