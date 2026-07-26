// Reads the current user's permission set from store/auth.store.ts; backs the <Can> gate. Never branch on role name here or anywhere downstream.

import { useCallback } from 'react'
import { useAuthStore } from '@/store/auth.store'

export function usePermission() {
  const permissions = useAuthStore((s) => s.user?.permissions ?? [])

  const has = useCallback((permission: string) => permissions.includes(permission), [permissions])
  const hasAny = useCallback((perms: string[]) => perms.some((p) => permissions.includes(p)), [permissions])
  const hasAll = useCallback((perms: string[]) => perms.every((p) => permissions.includes(p)), [permissions])

  return { permissions, has, hasAny, hasAll }
}
