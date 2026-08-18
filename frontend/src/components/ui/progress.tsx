// src/components/ui/progress.tsx
import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

const TONE_CLASS = {
  primary: 'bg-[var(--color-primary-600)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
  info: 'bg-[var(--color-info)]',
} as const

export type ProgressTone = keyof typeof TONE_CLASS

export interface ProgressProps
  extends Omit<React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>, 'color' | 'value'> {
  /** 0–100 */
  value?: number
  /** Semantic color from the design system. Ignored if `color` is set. */
  tone?: ProgressTone
  /** Explicit hex/CSS color, for matching a specific chart series. */
  color?: string
  /** Track height in px. */
  height?: number
  /** Render a percentage label to the right of the track. */
  showLabel?: boolean
}

/**
 * Thin progress / meter bar. Pass an explicit `color` to match a data series,
 * or a semantic `tone` (primary/success/warning/danger/info).
 */
export const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value = 0, tone = 'primary', color, height = 6, showLabel = false, style, ...props }, ref) => {
    const pct = Math.max(0, Math.min(100, value))

    return (
      <div className="flex items-center gap-2">
        <ProgressPrimitive.Root
          ref={ref}
          value={pct}
          className={cn(
            'relative flex-1 overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-surface)]',
            className
          )}
          style={{ height, ...style }}
          {...props}
        >
          <ProgressPrimitive.Indicator
            className={cn('h-full flex-1 rounded-[var(--radius-full)]', !color && (TONE_CLASS[tone] ?? TONE_CLASS.primary))}
            style={{
              transform: `translateX(-${100 - pct}%)`,
              transition: 'transform var(--transition-slow)',
              ...(color ? { backgroundColor: color } : {}),
            }}
          />
        </ProgressPrimitive.Root>
        {showLabel && (
          <span className="min-w-[34px] text-right font-mono text-[11px] text-[var(--color-text-secondary)]">
            {pct}%
          </span>
        )}
      </div>
    )
  }
)
Progress.displayName = 'Progress'
