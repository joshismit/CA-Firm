import { Business, Contact, Document, Task } from '@prisma/client';
import { LeadGlobalSearchRow } from '@modules/crm/repository/lead.repository';
import { SearchResultItemDto } from '../dto/search.res.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Search Mapper
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Maps each source module's own entity (never a second query) into the flat
 * `SearchResultItemDto` shape PRD §13.1 specifies. Mirrors every other
 * module's `*.mapper.ts` pattern (e.g. `permission.mapper.ts`,
 * `dashboard-preference.mapper.ts`) — pure functions, no I/O.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function matchesSearch(value: string | null | undefined, search: string): boolean {
  return !!value && value.toLowerCase().includes(search.toLowerCase());
}

/** Picks whichever searched field actually matched `search` — the "highlighted field" PRD §13.1 asks each result to carry. Falls back to the first candidate if none match (defensive only; every row reaching this function came from a query that matched at least one). */
function pickHighlightedField(candidates: Array<readonly [field: string, value: string | null | undefined]>, search: string): string {
  const hit = candidates.find(([, value]) => matchesSearch(value, search));
  return (hit ?? candidates[0])[0];
}

export function toBusinessSearchResult(business: Business, search: string): SearchResultItemDto {
  const highlightedField = pickHighlightedField(
    [
      ['name', business.name] as const,
      ['tradeName', business.tradeName] as const,
      ['pan', business.pan] as const,
      ['gstin', business.gstin] as const,
      ['din', business.din] as const,
      ['phone', business.phone] as const,
      ['email', business.email] as const,
    ],
    search,
  );

  return {
    id: business.id,
    type: 'BUSINESS',
    title: business.name,
    subtitle: business.pan ?? business.gstin ?? business.email ?? null,
    route: `/business/${business.id}`,
    highlightedField,
  };
}

export function toContactSearchResult(contact: Contact, search: string): SearchResultItemDto {
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  const highlightedField = pickHighlightedField(
    [
      ['firstName', contact.firstName] as const,
      ['lastName', contact.lastName] as const,
      ['email', contact.email] as const,
      ['phone', contact.phone] as const,
      ['pan', contact.pan] as const,
    ],
    search,
  );

  return {
    id: contact.id,
    type: 'CONTACT',
    title: fullName,
    subtitle: contact.email ?? contact.phone ?? null,
    route: `/contacts/${contact.id}`,
    highlightedField,
  };
}

/** See `LeadGlobalSearchRow`'s doc comment for why "company"/"email"/"phone" come from the linked Business/Contact rather than Lead itself. */
export function toLeadSearchResult(lead: LeadGlobalSearchRow, search: string): SearchResultItemDto {
  const companyName = lead.business?.name ?? null;
  const contactEmail = lead.contact?.email ?? null;
  const contactPhone = lead.contact?.phone ?? null;

  const highlightedField = pickHighlightedField(
    [
      ['title', lead.title] as const,
      ['company', companyName] as const,
      ['email', contactEmail] as const,
      ['phone', contactPhone] as const,
    ],
    search,
  );

  return {
    id: lead.id,
    type: 'LEAD',
    title: lead.title,
    subtitle: companyName ?? contactEmail ?? contactPhone ?? null,
    route: `/crm/${lead.id}`,
    highlightedField,
  };
}

/** Only one searchable field (`fileName`, PRD §13.1) — no ambiguity to resolve, unlike the multi-field mappers above. */
export function toDocumentSearchResult(document: Document): SearchResultItemDto {
  return {
    id: document.id,
    type: 'DOCUMENT',
    title: document.fileName,
    subtitle: document.category,
    route: `/documents/${document.id}`,
    highlightedField: 'fileName',
  };
}

/** Only one searchable field (`title`, PRD §13.1) — same reasoning as `toDocumentSearchResult()`. */
export function toTaskSearchResult(task: Task): SearchResultItemDto {
  return {
    id: task.id,
    type: 'TASK',
    title: task.title,
    subtitle: task.status,
    route: `/tasks/${task.id}`,
    highlightedField: 'title',
  };
}
