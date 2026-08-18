// src/components/ui/drawer.tsx
// Side-anchored panel on the same Radix Dialog primitive as ui/dialog.tsx, styled to slide in
// from a side instead of scaling in centered. Named lowercase to match this folder's convention.
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DrawerRoot = DialogPrimitive.Root
export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerClose = DialogPrimitive.Close
export const DrawerPortal = DialogPrimitive.Portal

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-[var(--z-modal)] bg-[var(--color-overlay)] backdrop-blur-[2px]', className)}
    style={{ animation: 'fadeIn var(--transition-base)', ...style }}
    {...props}
  />
))
DrawerOverlay.displayName = 'DrawerOverlay'

type DrawerSide = 'left' | 'right' | 'top' | 'bottom'
type DrawerSize = 'sm' | 'md' | 'lg'

const SIDE_POSITION: Record<DrawerSide, string> = {
  left: 'inset-y-0 left-0 border-r',
  right: 'inset-y-0 right-0 border-l',
  top: 'inset-x-0 top-0 border-b w-full',
  bottom: 'inset-x-0 bottom-0 border-t w-full',
}

const SIDE_SIZE: Record<DrawerSide, Record<DrawerSize, string>> = {
  left: { sm: 'w-[320px] max-w-[90vw]', md: 'w-[420px] max-w-[90vw]', lg: 'w-[560px] max-w-[90vw]' },
  right: { sm: 'w-[320px] max-w-[90vw]', md: 'w-[420px] max-w-[90vw]', lg: 'w-[560px] max-w-[90vw]' },
  top: { sm: 'h-[240px] max-h-[90vh]', md: 'h-[360px] max-h-[90vh]', lg: 'h-[480px] max-h-[90vh]' },
  bottom: { sm: 'h-[240px] max-h-[90vh]', md: 'h-[360px] max-h-[90vh]', lg: 'h-[480px] max-h-[90vh]' },
}

const SIDE_ANIMATION: Record<DrawerSide, string> = {
  left: 'slideInLeft',
  right: 'slideInRight',
  top: 'slideInTop',
  bottom: 'slideInBottom',
}

export interface DrawerContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: DrawerSide
  size?: DrawerSize
  hideClose?: boolean
}

export const DrawerContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DrawerContentProps>(
  ({ className, style, side = 'right', size = 'md', hideClose = false, children, ...props }, ref) => (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-[var(--z-modal)] flex flex-col overflow-hidden',
          'bg-[var(--color-card)] border-[var(--color-border)]',
          'shadow-[var(--shadow-xl)]',
          SIDE_POSITION[side],
          SIDE_SIZE[side][size],
          className
        )}
        style={{ animation: `${SIDE_ANIMATION[side]} var(--transition-slow)`, ...style }}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)]"
          >
            <X className="h-[18px] w-[18px]" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DrawerPortal>
  )
)
DrawerContent.displayName = 'DrawerContent'

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-[var(--color-border)] px-5 py-[18px] pr-11', className)} {...props} />
}

export const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-[18px] font-semibold text-[var(--color-text-heading)]', className)}
    style={{ letterSpacing: 'var(--heading-tracking)', ...style }}
    {...props}
  />
))
DrawerTitle.displayName = 'DrawerTitle'

export const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('mt-1 text-[13px] text-[var(--color-text-muted)]', className)} {...props} />
))
DrawerDescription.displayName = 'DrawerDescription'

export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto px-5 py-5 text-[13px] text-[var(--color-text-body)]', className)} {...props} />
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3.5', className)}
      {...props}
    />
  )
}
