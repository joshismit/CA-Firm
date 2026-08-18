// src/components/ui/dialog.tsx
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DialogRoot = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-6',
      'bg-[var(--color-overlay)] backdrop-blur-[2px]',
      className
    )}
    style={{ animation: 'fadeIn var(--transition-base)', ...style }}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DIALOG_WIDTHS = { sm: 380, md: 480, lg: 640 } as const

export interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: keyof typeof DIALOG_WIDTHS
  hideClose?: boolean
}

export const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, style, size = 'md', hideClose = false, children, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay>
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'relative flex w-full max-h-[85vh] flex-col overflow-hidden',
            'bg-[var(--color-card)] border border-[var(--color-border)]',
            'rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)]',
            className
          )}
          style={{ maxWidth: DIALOG_WIDTHS[size], animation: 'scaleIn var(--transition-slow)', ...style }}
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
      </DialogOverlay>
    </DialogPortal>
  )
)
DialogContent.displayName = DialogPrimitive.Content.displayName

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-b border-[var(--color-border)] px-5 py-[18px] pr-11', className)}
      {...props}
    />
  )
}

export const DialogTitle = React.forwardRef<
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
DialogTitle.displayName = DialogPrimitive.Title.displayName

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('mt-1 text-[13px] text-[var(--color-text-muted)]', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('overflow-y-auto px-5 py-5 text-[13px] text-[var(--color-text-body)]', className)} {...props} />
  )
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3.5', className)}
      {...props}
    />
  )
}
