// Redirects to /403 when the current user lacks the required permission(s).
// Intended for the rare whole-route gate (e.g. a Master Admin only route tree) - most
// in-page gating should use <Can> around individual buttons/menu items instead.

import { Navigate, Outlet } from 'react-router-dom'
import { usePermission } from '@/hooks/use-permission'

interface PermissionRouteProps {
  permission: string | string[]
  mode?: 'all' | 'any'
}

export function PermissionRoute({ permission, mode = 'all' }: PermissionRouteProps) {
  const { has, hasAny, hasAll } = usePermission()
  const perms = Array.isArray(permission) ? permission : [permission]

  const allowed = perms.length === 1 ? has(perms[0]) : mode === 'any' ? hasAny(perms) : hasAll(perms)

  return allowed ? <Outlet /> : <Navigate to="/403" replace />
}
