// src/components/ui/select.tsx
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  value?: string
  onChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** Simple styled dropdown select. Trigger matches Input's visual weight. */
export function Select({ value, onChange, options, placeholder = 'Select…', disabled, className }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)]',
          'bg-[var(--color-card)] px-3 text-[13px] text-[var(--color-text-body)] outline-none transition-colors',
          'data-[placeholder]:text-[var(--color-text-disabled)]',
          'focus:border-[var(--color-primary-600)] focus:ring-2 focus:ring-[var(--color-primary-600)]/15',
          'disabled:cursor-not-allowed disabled:bg-[var(--color-surface)] disabled:text-[var(--color-text-disabled)]',
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="z-[var(--z-dropdown)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-lg)]"
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-[var(--radius-sm)] py-2 pl-8 pr-3',
                  'text-[13px] text-[var(--color-text-body)] outline-none transition-colors',
                  'data-[highlighted]:bg-[var(--color-hover)] data-[state=checked]:font-medium'
                )}
              >
                <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-3.5 w-3.5 text-[var(--color-primary-600)]" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
