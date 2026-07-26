// src/components/ui/tooltip.tsx
import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, style, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-[var(--z-tooltip)] overflow-hidden whitespace-nowrap pointer-events-none',
        'rounded-[var(--radius-sm)] bg-[var(--color-neutral-900)] px-2 py-1.5',
        'text-[12px] font-medium text-white shadow-[var(--shadow-md)]',
        className
      )}
      style={{ animation: 'fadeIn var(--transition-fast)', ...style }}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export interface TooltipProps {
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactElement
  delayDuration?: number
}

/**
 * Hover/focus tooltip — dark bubble on a neutral-900 background. Wraps its
 * trigger child. For multiple tooltips on one page, wrapping the app once in
 * a shared `TooltipPrimitive.Provider` avoids each instance re-running the
 * open delay; left per-instance here to keep this a drop-in component.
 */
export function Tooltip({ content, side = 'top', children, delayDuration = 200 }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipContent side={side}>{content}</TooltipContent>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
