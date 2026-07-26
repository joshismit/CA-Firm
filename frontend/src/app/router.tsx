// src/app/router.tsx
import { createBrowserRouter, Link } from 'react-router-dom'
import { ShieldAlert, FileQuestion } from 'lucide-react'
import { ErrorLayout } from '@/layouts/ErrorLayout/ErrorLayout'
import { publicRoutes, protectedRoutes, masterAdminRoutes, clientPortalRoutes } from '@/routes'

function ErrorPage({ icon: Icon, code, title, description }: { icon: typeof ShieldAlert; code: string; title: string; description: string }) {
  return (
    <ErrorLayout>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-[var(--radius-xl)] bg-[var(--color-surface)] flex items-center justify-center">
          <Icon className="w-7 h-7 text-[var(--color-text-muted)]" />
        </div>
        <div>
          <p className="text-[13px] font-mono text-[var(--color-text-muted)]">{code}</p>
          <h1 className="mt-1 text-[20px] font-semibold text-[var(--color-text-heading)]">{title}</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{description}</p>
        </div>
        <Link
          to="/dashboard"
          className="h-9 px-4 inline-flex items-center rounded-[var(--radius-md)] text-[13px] font-medium text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </ErrorLayout>
  )
}

export const router = createBrowserRouter([
  publicRoutes,
  protectedRoutes,
  masterAdminRoutes,
  clientPortalRoutes,
  {
    path: '/403',
    element: (
      <ErrorPage
        icon={ShieldAlert}
        code="403"
        title="Access denied"
        description="You don't have permission to view this page."
      />
    ),
  },
  {
    path: '*',
    element: (
      <ErrorPage
        icon={FileQuestion}
        code="404"
        title="Page not found"
        description="The page you're looking for doesn't exist."
      />
    ),
  },
])
