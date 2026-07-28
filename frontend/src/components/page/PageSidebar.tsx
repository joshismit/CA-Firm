// src/components/page/PageSidebar.tsx
// Optional side column (filters rail, detail metadata) alongside a page's main content. Compose
// with PageContent inside a flex row, e.g.:
//   <div className="flex gap-6"><PageContent className="flex-1">...</PageContent><PageSidebar>...</PageSidebar></div>
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageSidebarProps {
  children: ReactNode
  /** Tailwind width class - defaults to a 288px rail. */
  width?: string
  className?: string
}

export function PageSidebar({ children, width = 'w-72', className }: PageSidebarProps) {
  return <aside className={cn('shrink-0', width, className)}>{children}</aside>
}
