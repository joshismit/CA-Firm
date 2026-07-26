// External client-portal routes, wrapped by ClientPortalLayout and a client-session guard.

import type { RouteObject } from 'react-router-dom'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { ClientPortalLayout } from '@/layouts/ClientPortalLayout/ClientPortalLayout'
import { ComingSoon } from '@/components/common/ComingSoon'

function ClientPortalGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hydrated = useAuthStore((s) => s.hydrated)

  if (!hydrated) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <Outlet />
}

export const clientPortalRoutes: RouteObject = {
  path: 'portal',
  element: <ClientPortalGuard />,
  children: [
    {
      element: <ClientPortalLayout />,
      children: [
        { index: true, element: <ComingSoon name="Client Portal" /> },
        { path: 'documents', element: <ComingSoon name="My Documents" /> },
      ],
    },
  ],
}
