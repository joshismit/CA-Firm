// src/components/navigation/Breadcrumb.tsx
// Extracted verbatim from Header.tsx's inline useBreadcrumbs()/JSX - same visual output, now reusable.
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { NAV_GROUPS } from '@/constants/navigation'

function useBreadcrumbs() {
  const location = useLocation()
  const parts = location.pathname.split('/').filter(Boolean)

  const crumbs: { label: string; path: string }[] = [{ label: 'Home', path: '/' }]

  let accumulated = ''
  for (const part of parts) {
    accumulated += `/${part}`
    let label = part.charAt(0).toUpperCase() + part.slice(1)
    for (const group of NAV_GROUPS) {
      const found = group.items.find((i) => i.path === accumulated)
      if (found) {
        label = found.label
        break
      }
    }
    crumbs.push({ label, path: accumulated })
  }

  return crumbs
}

export function Breadcrumb() {
  const crumbs = useBreadcrumbs()

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1.5 text-[12px]">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />}
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-[var(--color-text-heading)]" aria-current="page">
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
