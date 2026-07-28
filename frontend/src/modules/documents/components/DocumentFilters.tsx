// src/modules/documents/components/DocumentFilters.tsx
// Filter controls for the Documents list - rendered inside DataTable's toolbarFilters slot.
// Category is a real, hardcoded enum (DOCUMENT_CATEGORY_OPTIONS) so it's a fully populated Select,
// unlike CRM's stage filter which depends on a live query. `businessId` has no picker/list endpoint
// anywhere in the locked architecture, so it's a raw UUID input - same placeholder-until-a-picker
// pattern as every previous module's unresolvable foreign key.
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DOCUMENT_CATEGORY_OPTIONS } from '../constants'
import type { DocumentCategory } from '../types'

const CATEGORY_ALL_OPTION = { value: '__all__', label: 'All categories' }

export interface DocumentFiltersProps {
  category: DocumentCategory | undefined
  onCategoryChange: (category: DocumentCategory | undefined) => void
  businessId: string
  onBusinessIdChange: (businessId: string) => void
}

export function DocumentFilters({ category, onCategoryChange, businessId, onBusinessIdChange }: DocumentFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={category ?? '__all__'}
        onChange={(value) => onCategoryChange(value === '__all__' ? undefined : (value as DocumentCategory))}
        options={[CATEGORY_ALL_OPTION, ...DOCUMENT_CATEGORY_OPTIONS]}
        className="h-8 w-[170px]"
        placeholder="Category"
      />
      <Input
        value={businessId}
        onChange={(e) => onBusinessIdChange(e.target.value)}
        placeholder="Filter by business ID (UUID)"
        className="h-8 w-[220px]"
        aria-label="Filter documents by business ID"
      />
    </div>
  )
}
