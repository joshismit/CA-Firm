// src/components/shared/ExportButton/ExportButton.tsx
// Generic "Export CSV" action for any list page - exports exactly the rows it's given (the
// currently loaded page, or the current bulk selection if the caller passes that instead), never
// a silently-fetched larger set. Reusable across Business/Contacts/CRM/Documents (and future
// modules) rather than a per-module duplicate.
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportRowsToCsv, type CsvColumn } from '@/lib/csv-export'

export interface ExportButtonProps<T> {
  rows: T[]
  columns: CsvColumn<T>[]
  filename: string
  label?: string
  disabled?: boolean
}

export function ExportButton<T>({ rows, columns, filename, label = 'Export CSV', disabled }: ExportButtonProps<T>) {
  return (
    <Button
      variant="secondary"
      size="sm"
      leadingIcon={<Download className="w-3.5 h-3.5" />}
      disabled={disabled || rows.length === 0}
      onClick={() => exportRowsToCsv(rows, columns, filename)}
    >
      {label}
    </Button>
  )
}
