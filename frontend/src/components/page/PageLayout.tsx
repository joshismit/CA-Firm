// src/components/page/PageLayout.tsx
// Formalizes the outer wrapper every page has repeated by hand (`<div className="space-y-6">`).
// AppLayout's <main> already constrains width/padding (max-w-[1280px] mx-auto p-6) - this only
// owns the vertical rhythm between a page's sections, it must not add its own width/padding.
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageLayoutProps {
  children: ReactNode
  className?: string
}

export function PageLayout({ children, className }: PageLayoutProps) {
  return <div className={cn('space-y-6', className)}>{children}</div>
}
