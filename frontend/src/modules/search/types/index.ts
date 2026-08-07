// Types scoped to Global Search (PRD §13.1). Field shapes mirror
// backend/src/modules/search/dto/search.res.dto.ts exactly.

export type SearchResultType = 'BUSINESS' | 'CONTACT' | 'LEAD' | 'DOCUMENT' | 'TASK'

export interface SearchResultItem {
  id: string
  type: SearchResultType
  title: string
  subtitle: string | null
  route: string
  highlightedField: string
}

export interface SearchResults {
  businesses: SearchResultItem[]
  contacts: SearchResultItem[]
  leads: SearchResultItem[]
  documents: SearchResultItem[]
  tasks: SearchResultItem[]
}
