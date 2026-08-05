// src/modules/documents/components/FolderBreadcrumbs.tsx
// Folder-hierarchy breadcrumb trail (PRD §7.1 rule 9) - driven by in-page selection state, not the
// URL (unlike components/navigation/Breadcrumb.tsx), since navigating folders doesn't change route.
// Walks the parentFolderId chain from the currently selected folder back up to the category root.
import { ChevronRight } from 'lucide-react'
import { DOCUMENT_CATEGORY_LABELS } from '../constants'
import type { DocumentCategory, DocumentFolder } from '../types'

export interface FolderBreadcrumbsProps {
  category: DocumentCategory
  /** Every folder loaded for the current Business/category - used to walk the parent chain. */
  folders: DocumentFolder[]
  selectedFolderId: string | null
  onSelect: (folderId: string | null) => void
}

export function FolderBreadcrumbs({ category, folders, selectedFolderId, onSelect }: FolderBreadcrumbsProps) {
  const byId = new Map(folders.map((f) => [f.id, f]))

  const trail: DocumentFolder[] = []
  let current = selectedFolderId ? byId.get(selectedFolderId) : undefined
  while (current) {
    trail.unshift(current)
    current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined
  }

  return (
    <nav aria-label="Folder breadcrumb" className="flex items-center gap-1.5 flex-wrap">
      <span className="flex items-center gap-1.5 text-[12px]">
        {trail.length === 0 ? (
          <span className="font-medium text-[var(--color-text-heading)]" aria-current="page">
            {DOCUMENT_CATEGORY_LABELS[category] ?? category}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] transition-colors"
          >
            {DOCUMENT_CATEGORY_LABELS[category] ?? category}
          </button>
        )}
      </span>
      {trail.map((folder, i) => (
        <span key={folder.id} className="flex items-center gap-1.5 text-[12px]">
          <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          {i === trail.length - 1 ? (
            <span className="font-medium text-[var(--color-text-heading)]" aria-current="page">
              {folder.name}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onSelect(folder.id)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] transition-colors"
            >
              {folder.name}
            </button>
          )}
        </span>
      ))}
    </nav>
  )
}
