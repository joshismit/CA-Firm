// src/app/router.tsx
import { createBrowserRouter, isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'
import { ErrorLayout } from '@/layouts/ErrorLayout/ErrorLayout'
import { NoPermission, NotFound } from '@/components/feedback'
import { ErrorFallback } from '@/providers/ErrorBoundary'
import { publicRoutes, protectedRoutes, masterAdminRoutes, clientPortalRoutes } from '@/routes'

// React Router's data router catches render/loader errors at the route level before they can
// reach the top-level <ErrorBoundary> in providers/AppProviders.tsx (which sits outside
// <RouterProvider>). Every top-level route group below gets this as its errorElement so page
// errors render the same fallback instead of React Router's built-in "Unexpected Application
// Error!" page.
function RouteErrorBoundary() {
  const routeError = useRouteError()
  const navigate = useNavigate()

  const error =
    routeError instanceof Error
      ? routeError
      : new Error(isRouteErrorResponse(routeError) ? `${routeError.status} ${routeError.statusText}` : 'Unknown error')

  return (
    <ErrorLayout>
      <ErrorFallback error={error} onRetry={() => navigate(0)} />
    </ErrorLayout>
  )
}

export const router = createBrowserRouter([
  { ...publicRoutes, errorElement: <RouteErrorBoundary /> },
  { ...protectedRoutes, errorElement: <RouteErrorBoundary /> },
  { ...masterAdminRoutes, errorElement: <RouteErrorBoundary /> },
  { ...clientPortalRoutes, errorElement: <RouteErrorBoundary /> },
  {
    path: '/403',
    element: (
      <ErrorLayout>
        <NoPermission />
      </ErrorLayout>
    ),
  },
  {
    path: '*',
    element: (
      <ErrorLayout>
        <NotFound />
      </ErrorLayout>
    ),
  },
])
