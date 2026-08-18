// src/components/modals/Dialog.tsx
import * as React from 'react'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: React.ReactNode
  children?: React.ReactNode
}

/**
 * Modal dialog: overlay + blur, header (title, description, close),
 * scrollable body, right-aligned footer actions. Controlled via `open`/`onClose`.
 * Sizes sm/md/lg cap width at 380/480/640px.
 */
export function Dialog({ open, onClose, title, description, size = 'md', footer, children }: DialogProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </DialogRoot>
  )
}
