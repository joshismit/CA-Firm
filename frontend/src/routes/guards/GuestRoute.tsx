// Redirects already-authenticated users away from public-only routes (e.g. /login).

import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

export function GuestRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hydrated = useAuthStore((s) => s.hydrated)

  if (!hydrated) return null

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
