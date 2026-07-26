// src/components/feedback/ErrorState.tsx
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
      <div className="w-14 h-14 rounded-[var(--radius-xl)] bg-[var(--color-danger-bg)] flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-[var(--color-danger)]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--color-text-heading)]">{title}</h3>
      {message && (
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)] max-w-sm">{message}</p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
