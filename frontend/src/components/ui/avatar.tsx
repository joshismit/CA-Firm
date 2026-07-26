// src/components/ui/avatar.tsx
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn, getInitials, getColorIndex } from '@/lib/utils'

const AVATAR_GRADIENTS = [
  'from-[var(--color-primary-400)] to-[var(--color-primary-600)]',
  'from-[var(--color-success-400)] to-[var(--color-success-600)]',
  'from-[var(--color-info-400)] to-[var(--color-info-600)]',
  'from-[var(--color-warning-400)] to-[var(--color-warning-600)]',
  'from-[var(--color-danger-400)] to-[var(--color-danger-600)]',
]

const SIZE_CLASS = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-[11px]',
  lg: 'h-11 w-11 text-[13px]',
} as const

export interface AvatarProps {
  name: string
  src?: string
  size?: keyof typeof SIZE_CLASS
  className?: string
}

/** Circular avatar: image if `src` is given, else a deterministic gradient with initials from `name`. */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const gradient = AVATAR_GRADIENTS[getColorIndex(name, AVATAR_GRADIENTS.length)]
  return (
    <AvatarPrimitive.Root
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br',
        gradient,
        SIZE_CLASS[size],
        className
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name} className="h-full w-full object-cover" />}
      <AvatarPrimitive.Fallback delayMs={src ? 300 : undefined} className="font-bold text-white">
        {getInitials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
