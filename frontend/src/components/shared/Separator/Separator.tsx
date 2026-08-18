// src/components/shared/Separator/Separator.tsx
import { cn } from '@/lib/utils'

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

/** Hairline divider. Horizontal by default; pass orientation="vertical" for inline use. */
export function Separator({ orientation = 'horizontal', className }: SeparatorProps) {
  const isVertical = orientation === 'vertical'
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn('shrink-0 bg-[var(--color-border)]', isVertical ? 'h-[1em] w-px' : 'h-px w-full', className)}
    />
  )
}
