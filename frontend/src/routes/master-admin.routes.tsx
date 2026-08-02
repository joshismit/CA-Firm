// Master-admin portal routes, wrapped by MasterAdminLayout and a platform-admin guard.
//
// Gating the master-admin area on user.role is a deliberate, narrow exception to "never branch
// on role name" - it's a structural top-level portal split baked into the JWT itself, not a
// fine-grained ACL decision. In-app feature gating must still go through <Can>/usePermission.

import type { RouteObject } from 'react-router-dom'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { MasterAdminLayout } from '@/layouts/MasterAdminLayout/MasterAdminLayout'
import {
  MasterAdminDashboardPage,
  MasterAdminLoginPage,
  CreateTenantPage,
  TenantDetailPage,
  TenantsListPage,
  SubscriptionsPage,
} from '@/modules/master-admin/pages'

function MasterAdminGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hydrated = useAuthStore((s) => s.hydrated)
  const role = useAuthStore((s) => s.user?.role)

  if (!hydrated) return null
  // A master admin isn't a tenant User row, so /login (POST /auth/login) can never authenticate
  // one - redirect to this portal's own login instead.
  if (!isAuthenticated) return <Navigate to="/master-admin/login" replace />
  if (role !== 'MASTER_ADMIN') return <Navigate to="/403" replace />

  return <Outlet />
}

/** Standalone, unauthenticated - not nested under `masterAdminRoutes` below since that whole
 *  subtree sits behind `MasterAdminGuard`. Rendered outside GuestRoute/AuthLayout too (see
 *  MasterAdminLoginPage's header comment) - this portal is structurally separate from the tenant app. */
export const masterAdminLoginRoute: RouteObject = {
  path: 'master-admin/login',
  element: <MasterAdminLoginPage />,
}

export const masterAdminRoutes: RouteObject = {
  path: 'master-admin',
  element: <MasterAdminGuard />,
  children: [
    {
      element: <MasterAdminLayout />,
      children: [
        { index: true, element: <MasterAdminDashboardPage /> },
        { path: 'tenants', element: <TenantsListPage /> },
        { path: 'tenants/new', element: <CreateTenantPage /> },
        { path: 'tenants/:id', element: <TenantDetailPage /> },
        { path: 'subscriptions', element: <SubscriptionsPage /> },
      ],
    },
  ],
}
