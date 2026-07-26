// Master-admin portal routes, wrapped by MasterAdminLayout and a platform-admin guard.
//
// Gating the master-admin area on user.role is a deliberate, narrow exception to "never branch
// on role name" - it's a structural top-level portal split baked into the JWT itself, not a
// fine-grained ACL decision. In-app feature gating must still go through <Can>/usePermission.

import type { RouteObject } from 'react-router-dom'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { MasterAdminLayout } from '@/layouts/MasterAdminLayout/MasterAdminLayout'
import { ComingSoon } from '@/components/common/ComingSoon'

function MasterAdminGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hydrated = useAuthStore((s) => s.hydrated)
  const role = useAuthStore((s) => s.user?.role)

  if (!hydrated) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role !== 'MASTER_ADMIN') return <Navigate to="/403" replace />

  return <Outlet />
}

export const masterAdminRoutes: RouteObject = {
  path: 'master-admin',
  element: <MasterAdminGuard />,
  children: [
    {
      element: <MasterAdminLayout />,
      children: [
        { index: true, element: <ComingSoon name="Master Admin Dashboard" /> },
        { path: 'tenants', element: <ComingSoon name="Tenant Management" /> },
        { path: 'subscriptions', element: <ComingSoon name="Subscriptions & Plans" /> },
      ],
    },
  ],
}
