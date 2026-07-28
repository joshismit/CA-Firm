// src/components/page/PageContent.tsx
// Main content region of a page - wraps whatever the page's primary content is (DataTable,
// Card-row list, form). Owns the vertical spacing between stacked content blocks.
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageContentProps {
  children: ReactNode
  className?: string
}

export function PageContent({ children, className }: PageContentProps) {
  return <div className={cn('space-y-4', className)}>{children}</div>
}
