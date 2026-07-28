// src/components/page/PageSearch.tsx
// Page-level search input, styled identically to DataTableToolbar's search field, for pages
// whose main content isn't a DataTable (e.g. a Card-row list) but still wants the same search UI.
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface PageSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function PageSearch({ value, onChange, placeholder = 'Search…', className }: PageSearchProps) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      icon={<Search size={14} />}
      className={cn('w-full sm:w-64', className)}
    />
  )
}
