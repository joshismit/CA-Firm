// src/components/ui/button.tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  cn(
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-md)]',
    'font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60'
  ),
  {
    variants: {
      variant: {
        primary: 'bg-[var(--color-primary-600)] text-white shadow-[var(--shadow-xs)] hover:bg-[var(--color-primary-700)]',
        secondary:
          'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]',
        outline: 'border border-[var(--color-border)] bg-transparent text-[var(--color-text-body)] hover:bg-[var(--color-hover)]',
        ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]',
        danger: 'bg-[var(--color-danger-600)] text-white shadow-[var(--shadow-xs)] hover:bg-[var(--color-danger-700)]',
      },
      size: {
        sm: 'h-8 px-3 text-[12px]',
        md: 'h-9 px-3.5 text-[13px]',
        lg: 'h-11 px-5 text-[15px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, leadingIcon, trailingIcon, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  )
)
Button.displayName = 'Button'
