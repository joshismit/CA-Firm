// src/components/forms/FormField.tsx
import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface FormFieldProps {
  label: ReactNode
  htmlFor?: string
  error?: string
  className?: string
  children: ReactNode
}

/** Label + control + optional error message. Wraps an Input/Select/etc. */
export function FormField({ label, htmlFor, error, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-[12px] text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
