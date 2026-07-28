// src/modules/documents/components/DocumentHeader.tsx
// Composes the shared PageHeader/PageActions with document-specific content - pages never build
// this header inline.
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, PageActions } from '@/components/page'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import { DocumentQuickActions } from './DocumentQuickActions'
import type { DocumentFile } from '../types'

export interface DocumentHeaderProps {
  document: DocumentFile
}

export function DocumentHeader({ document }: DocumentHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        to="/documents"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to documents
      </Link>

      <PageHeader
        title={document.fileName}
        description={`Version ${document.version}`}
        actions={
          <PageActions>
            <DocumentStatusBadge category={document.category} />
            <DocumentQuickActions document={document} />
          </PageActions>
        }
      />
    </div>
  )
}
