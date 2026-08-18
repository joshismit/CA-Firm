// src/components/ui/icon-button.tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const iconButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]',
        secondary: 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]',
        outline:
          'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]',
        ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]',
      },
      size: {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  }
)

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Required — the button has no visible text, so this drives its accessible name. */
  label: string
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, label, children, ...props }, ref) => (
    <button ref={ref} type="button" aria-label={label} className={cn(iconButtonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  )
)
IconButton.displayName = 'IconButton'
