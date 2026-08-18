// src/components/feedback/Spinner.tsx
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type SpinnerSize = 'sm' | 'md' | 'lg'
type SpinnerColor = 'primary' | 'muted' | 'white'

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-9 w-9',
}

const COLOR_CLASS: Record<SpinnerColor, string> = {
  primary: 'text-[var(--color-primary-600)]',
  muted: 'text-[var(--color-text-muted)]',
  white: 'text-white',
}

export interface SpinnerProps {
  size?: SpinnerSize
  color?: SpinnerColor
  /** Renders as a fixed, full-viewport overlay instead of an inline block. */
  fullScreen?: boolean
  label?: string
  className?: string
}

export function Spinner({ size = 'md', color = 'primary', fullScreen = false, label, className }: SpinnerProps) {
  const content = (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)} role="status" aria-live="polite">
      <Loader2 className={cn('animate-spin', SIZE_CLASS[size], COLOR_CLASS[color])} />
      {label && <span className="text-[12px] text-[var(--color-text-muted)]">{label}</span>}
      <span className="sr-only">Loading</span>
    </div>
  )

  if (!fullScreen) return content

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--color-overlay)]">
      {content}
    </div>
  )
}
