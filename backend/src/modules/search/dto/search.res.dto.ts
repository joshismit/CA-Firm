/** PRD §13.1 — one entry per grouped category in `SearchResultsResponseDto`. */
export type SearchResultType = 'BUSINESS' | 'CONTACT' | 'LEAD' | 'DOCUMENT' | 'TASK';

/** PRD §13.1 — "Each result must include id, type, title, subtitle, route, highlighted field." */
export interface SearchResultItemDto {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  route: string;
  highlightedField: string;
}

/** PRD §13.1 — the exact grouped response shape the PRD specifies. */
export interface SearchResultsResponseDto {
  businesses: SearchResultItemDto[];
  contacts: SearchResultItemDto[];
  leads: SearchResultItemDto[];
  documents: SearchResultItemDto[];
  tasks: SearchResultItemDto[];
}
