// Permission-based render gate - <Can permission="tasks:create">...</Can>. Reads from the permission store via hooks/use-permission; UI must never branch on hardcoded role names.

import type { ReactNode } from 'react'
import { usePermission } from '@/hooks/use-permission'

interface CanProps {
  permission: string | string[]
  /** When `permission` is an array: require every permission ('all', default) or any one of them ('any'). */
  mode?: 'all' | 'any'
  fallback?: ReactNode
  children: ReactNode
}

export function Can({ permission, mode = 'all', fallback = null, children }: CanProps) {
  const { has, hasAny, hasAll } = usePermission()
  const perms = Array.isArray(permission) ? permission : [permission]

  const allowed = perms.length === 1 ? has(perms[0]) : mode === 'any' ? hasAny(perms) : hasAll(perms)

  return allowed ? <>{children}</> : <>{fallback}</>
}
