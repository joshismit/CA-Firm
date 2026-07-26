// src/components/shared/Card/Card.tsx
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type CardPadding = 'sm' | 'md' | 'lg'

const PADDING_CLASS: Record<CardPadding, string> = {
  sm: 'p-4', // 16px
  md: 'p-5', // 20px
  lg: 'p-6', // 24px
}

interface CardProps {
  padding?: CardPadding
  children: ReactNode
  className?: string
}

/**
 * Base surface panel — white card, 1px border, radius-lg, shadow-sm.
 * Compose CardHeader (title + action) with content. Cards stay flat and
 * quiet: no colored left-borders, no heavy shadows.
 */
export function Card({ padding = 'md', children, className }: CardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--color-card)] border border-[var(--color-border)]',
        'rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]',
        PADDING_CLASS[padding],
        className
      )}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: ReactNode
  action?: ReactNode
  className?: string
}

/** Title row for a Card, with an optional right-aligned action slot. */
export function CardHeader({ title, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <h3 className="text-[15px] font-semibold text-[var(--color-text-heading)] leading-tight tracking-tight">
        {title}
      </h3>
      {action}
    </div>
  )
}
