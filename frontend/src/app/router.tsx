// src/app/router.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout/AppLayout'
import { DashboardPage } from '@/modules/dashboard/pages/DashboardPage'

// Placeholder page for unbuilt routes
function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-16 h-16 rounded-[var(--radius-xl)] bg-[var(--color-surface)] flex items-center justify-center">
        <span className="text-3xl">🚧</span>
      </div>
      <div className="text-center">
        <h2 className="text-[18px] font-semibold text-[var(--color-text-heading)]">{name}</h2>
        <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
          This module is under development.
        </p>
      </div>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'analytics', element: <ComingSoon name="Analytics" /> },
      { path: 'clients', element: <ComingSoon name="Clients" /> },
      { path: 'clients/new', element: <ComingSoon name="Add Client" /> },
      { path: 'gst', element: <ComingSoon name="GST Returns" /> },
      { path: 'itr', element: <ComingSoon name="Income Tax (ITR)" /> },
      { path: 'tds', element: <ComingSoon name="TDS / 26Q" /> },
      { path: 'mca', element: <ComingSoon name="MCA / ROC" /> },
      { path: 'billing/invoices', element: <ComingSoon name="Invoices" /> },
      { path: 'billing/expenses', element: <ComingSoon name="Expenses" /> },
      { path: 'billing/payments', element: <ComingSoon name="Payments" /> },
      { path: 'tasks/my', element: <ComingSoon name="My Tasks" /> },
      { path: 'tasks/team', element: <ComingSoon name="Team Tasks" /> },
      { path: 'documents', element: <ComingSoon name="Document Vault" /> },
      { path: 'documents/templates', element: <ComingSoon name="Templates" /> },
      { path: 'staff', element: <ComingSoon name="Team" /> },
      { path: 'staff/roles', element: <ComingSoon name="Roles & Permissions" /> },
      { path: 'notifications', element: <ComingSoon name="Notifications" /> },
      { path: 'settings', element: <ComingSoon name="Settings" /> },
    ],
  },
])
