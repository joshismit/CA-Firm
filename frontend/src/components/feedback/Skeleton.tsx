// src/components/feedback/Skeleton.tsx
// Built on the existing `.shimmer` keyframe utility (src/styles/globals.css) - not a new animation.
import { cn } from '@/lib/utils'

type SkeletonVariant = 'text' | 'avatar' | 'card' | 'table'

export interface SkeletonProps {
  variant?: SkeletonVariant
  width?: string | number
  height?: string | number
  /** Number of rows to render when variant="table". */
  rows?: number
  className?: string
}

const base = 'shimmer bg-[var(--color-surface)]'

function toCss(value: string | number | undefined): string | undefined {
  if (value == null) return undefined
  return typeof value === 'number' ? `${value}px` : value
}

export function Skeleton({ variant = 'text', width, height, rows = 5, className }: SkeletonProps) {
  const w = toCss(width)
  const h = toCss(height)

  if (variant === 'avatar') {
    return (
      <div
        className={cn(base, 'rounded-full', className)}
        style={{ width: w ?? '36px', height: h ?? '36px' }}
      />
    )
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(base, 'rounded-[var(--radius-lg)]', className)}
        style={{ width: w ?? '100%', height: h ?? '120px' }}
      />
    )
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cn(base, 'rounded-[var(--radius-sm)]')} style={{ width: '100%', height: h ?? '36px' }} />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(base, 'rounded-[var(--radius-sm)]', className)}
      style={{ width: w ?? '100%', height: h ?? '14px' }}
    />
  )
}
