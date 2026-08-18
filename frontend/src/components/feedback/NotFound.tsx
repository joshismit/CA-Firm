// src/components/feedback/NotFound.tsx
// Canonical 404 page. Used by app/router.tsx's catch-all route so the visual is defined once.
import { Link } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'

export interface NotFoundProps {
  title?: string
  description?: string
  backTo?: string
  backLabel?: string
}

export function NotFound({
  title = 'Page not found',
  description = "The page you're looking for doesn't exist.",
  backTo = '/dashboard',
  backLabel = 'Back to dashboard',
}: NotFoundProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-16 h-16 rounded-[var(--radius-xl)] bg-[var(--color-surface)] flex items-center justify-center">
        <FileQuestion className="w-7 h-7 text-[var(--color-text-muted)]" />
      </div>
      <div>
        <p className="text-[13px] font-mono text-[var(--color-text-muted)]">404</p>
        <h1 className="mt-1 text-[20px] font-semibold text-[var(--color-text-heading)]">{title}</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{description}</p>
      </div>
      <Link
        to={backTo}
        className="h-9 px-4 inline-flex items-center rounded-[var(--radius-md)] text-[13px] font-medium text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] transition-colors"
      >
        {backLabel}
      </Link>
    </div>
  )
}
