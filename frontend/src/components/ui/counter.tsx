// src/components/ui/counter.tsx
import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const counterVariants = cva('inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[var(--radius-full)] px-1.5 text-[11px] font-semibold leading-none', {
  variants: {
    variant: {
      default: 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)]',
      solid: 'bg-[var(--color-danger)] text-white',
      muted: 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
    },
  },
  defaultVariants: { variant: 'default' },
})

export interface CounterProps extends VariantProps<typeof counterVariants> {
  children: ReactNode
  className?: string
}

/** Small numeric/text count pill — notification counts, tab counts, "New" tags. */
export function Counter({ variant, children, className }: CounterProps) {
  return <span className={cn(counterVariants({ variant }), className)}>{children}</span>
}
