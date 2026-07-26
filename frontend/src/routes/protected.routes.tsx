// Authenticated tenant-app routes, wrapped by AppLayout and ProtectedRoute.

import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout/AppLayout'
import { ComingSoon } from '@/components/common/ComingSoon'
import { DashboardPage } from '@/modules/dashboard/pages/DashboardPage'
import { ClientsPage } from '@/modules/clients/pages/ClientsPage'
import { ProjectsPage } from '@/modules/projects/pages/ProjectsPage'
import { ProjectDetailPage } from '@/modules/projects/pages/ProjectDetailPage'
import { TasksPage } from '@/modules/tasks/pages/TasksPage'
import { TaskDetailPage } from '@/modules/tasks/pages/TaskDetailPage'
import { settingsRoutes } from './settings.routes'

export const protectedRoutes: RouteObject = {
  element: <ProtectedRoute />,
  children: [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'analytics', element: <ComingSoon name="Analytics" /> },
        { path: 'clients', element: <ClientsPage /> },
        { path: 'clients/new', element: <ComingSoon name="Add Client" /> },
        { path: 'projects', element: <ProjectsPage /> },
        { path: 'projects/:id', element: <ProjectDetailPage /> },
        { path: 'gst', element: <ComingSoon name="GST Returns" /> },
        { path: 'itr', element: <ComingSoon name="Income Tax (ITR)" /> },
        { path: 'tds', element: <ComingSoon name="TDS / 26Q" /> },
        { path: 'mca', element: <ComingSoon name="MCA / ROC" /> },
        { path: 'billing/invoices', element: <ComingSoon name="Invoices" /> },
        { path: 'billing/expenses', element: <ComingSoon name="Expenses" /> },
        { path: 'billing/payments', element: <ComingSoon name="Payments" /> },
        { path: 'tasks/my', element: <TasksPage scope="my" /> },
        { path: 'tasks/team', element: <TasksPage scope="team" /> },
        { path: 'tasks/:id', element: <TaskDetailPage /> },
        { path: 'documents', element: <ComingSoon name="Document Vault" /> },
        { path: 'documents/templates', element: <ComingSoon name="Templates" /> },
        { path: 'staff', element: <ComingSoon name="Team" /> },
        { path: 'staff/roles', element: <ComingSoon name="Roles & Permissions" /> },
        { path: 'notifications', element: <ComingSoon name="Notifications" /> },
        { path: 'settings', children: settingsRoutes },
      ],
    },
  ],
}
