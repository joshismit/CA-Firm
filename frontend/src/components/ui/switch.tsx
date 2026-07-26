// src/components/ui/switch.tsx
import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'relative inline-flex h-6 w-[42px] shrink-0 items-center rounded-[var(--radius-full)] border border-transparent transition-colors',
      'data-[state=unchecked]:bg-[var(--color-border-strong)] data-[state=checked]:bg-[var(--color-primary-600)]',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'block h-[18px] w-[18px] translate-x-[3px] rounded-full bg-white shadow-[var(--shadow-sm)] transition-transform',
        'data-[state=checked]:translate-x-[21px]'
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName
