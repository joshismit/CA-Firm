// src/modules/contacts/components/ContactFilters.tsx
// Filter controls for the Contacts list - rendered inside DataTable's toolbarFilters slot.
// ContactListFilters (locked types) only exposes `businessId` beyond search/pagination/sort - there
// is no status enum on Contact to filter by. No business-picker component/endpoint exists yet, so
// this is a raw-ID input, same placeholder-until-a-picker-exists pattern BusinessForm uses for typeId.
import { Input } from '@/components/ui/input'

export interface ContactFiltersProps {
  businessId: string
  onBusinessIdChange: (businessId: string) => void
}

export function ContactFilters({ businessId, onBusinessIdChange }: ContactFiltersProps) {
  return (
    <Input
      value={businessId}
      onChange={(e) => onBusinessIdChange(e.target.value)}
      placeholder="Filter by business ID (UUID)"
      className="h-8 w-[220px]"
      aria-label="Filter contacts by business ID"
    />
  )
}
