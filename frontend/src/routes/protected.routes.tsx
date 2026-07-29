// Authenticated tenant-app routes, wrapped by AppLayout and ProtectedRoute.

import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout/AppLayout'
import { ComingSoon } from '@/components/common/ComingSoon'
import { DashboardPage } from '@/modules/dashboard/pages/DashboardPage'
import { AnalyticsPage } from '@/modules/dashboard/pages/AnalyticsPage'
import { ClientsPage } from '@/modules/clients/pages/ClientsPage'
import { ProjectsPage } from '@/modules/projects/pages/ProjectsPage'
import { ProjectDetailPage } from '@/modules/projects/pages/ProjectDetailPage'
import { ProjectCreatePage } from '@/modules/projects/pages/ProjectCreatePage'
import { ProjectEditPage } from '@/modules/projects/pages/ProjectEditPage'
import { ComplianceListPage, ComplianceDetailPage, ComplianceCreatePage, ComplianceEditPage } from '@/modules/compliance/pages'
import {
  InvoiceListPage,
  InvoiceDetailPage,
  InvoiceCreatePage,
  InvoiceEditPage,
  ExpenseListPage,
  ExpenseDetailPage,
  ExpenseCreatePage,
  ExpenseEditPage,
  PaymentListPage,
  PaymentDetailPage,
  PaymentCreatePage,
  PaymentEditPage,
} from '@/modules/client-billing/pages'
import { NotificationListPage, NotificationDetailPage } from '@/modules/notifications/pages'
import { ReportsListPage, ReportDetailPage } from '@/modules/reports/pages'
import { AuditListPage, AuditDetailPage } from '@/modules/audit/pages'
import { AdministrationHomePage } from '@/modules/administration/pages'
import { UsersPage, UserDetailPage, UserCreatePage, UserEditPage } from '@/modules/users/pages'
import { RolesPage, RoleDetailPage, RoleCreatePage, RoleEditPage } from '@/modules/roles/pages'
import { PermissionsPage, PermissionDetailPage } from '@/modules/permissions/pages'
import { TasksPage } from '@/modules/tasks/pages/TasksPage'
import { TaskDetailPage } from '@/modules/tasks/pages/TaskDetailPage'
import {
  BusinessListPage,
  BusinessDetailPage,
  BusinessCreatePage,
  BusinessEditPage,
} from '@/modules/business/pages'
import {
  ContactsListPage,
  ContactDetailPage,
  ContactCreatePage,
  ContactEditPage,
} from '@/modules/contacts/pages'
import { CRMListPage, CRMDetailPage, CRMCreatePage, CRMEditPage } from '@/modules/crm/pages'
import {
  DocumentListPage,
  DocumentDetailPage,
  DocumentUploadPage,
  DocumentEditPage,
} from '@/modules/documents/pages'
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
        { path: 'analytics', element: <AnalyticsPage /> },
        { path: 'clients', element: <ClientsPage /> },
        { path: 'clients/new', element: <ComingSoon name="Add Client" /> },
        { path: 'business', element: <BusinessListPage /> },
        { path: 'business/new', element: <BusinessCreatePage /> },
        { path: 'business/:id', element: <BusinessDetailPage /> },
        { path: 'business/:id/edit', element: <BusinessEditPage /> },
        { path: 'contacts', element: <ContactsListPage /> },
        { path: 'contacts/new', element: <ContactCreatePage /> },
        { path: 'contacts/:id', element: <ContactDetailPage /> },
        { path: 'contacts/:id/edit', element: <ContactEditPage /> },
        { path: 'crm', element: <CRMListPage /> },
        { path: 'crm/new', element: <CRMCreatePage /> },
        { path: 'crm/:id', element: <CRMDetailPage /> },
        { path: 'crm/:id/edit', element: <CRMEditPage /> },
        { path: 'projects', element: <ProjectsPage /> },
        { path: 'projects/new', element: <ProjectCreatePage /> },
        { path: 'projects/:id', element: <ProjectDetailPage /> },
        { path: 'projects/:id/edit', element: <ProjectEditPage /> },
        { path: 'gst', element: <ComplianceListPage moduleKey="gst" /> },
        { path: 'gst/new', element: <ComplianceCreatePage moduleKey="gst" /> },
        { path: 'gst/:id', element: <ComplianceDetailPage moduleKey="gst" /> },
        { path: 'gst/:id/edit', element: <ComplianceEditPage moduleKey="gst" /> },
        { path: 'itr', element: <ComplianceListPage moduleKey="itr" /> },
        { path: 'itr/new', element: <ComplianceCreatePage moduleKey="itr" /> },
        { path: 'itr/:id', element: <ComplianceDetailPage moduleKey="itr" /> },
        { path: 'itr/:id/edit', element: <ComplianceEditPage moduleKey="itr" /> },
        { path: 'tds', element: <ComplianceListPage moduleKey="tds" /> },
        { path: 'tds/new', element: <ComplianceCreatePage moduleKey="tds" /> },
        { path: 'tds/:id', element: <ComplianceDetailPage moduleKey="tds" /> },
        { path: 'tds/:id/edit', element: <ComplianceEditPage moduleKey="tds" /> },
        { path: 'mca', element: <ComplianceListPage moduleKey="mca" /> },
        { path: 'mca/new', element: <ComplianceCreatePage moduleKey="mca" /> },
        { path: 'mca/:id', element: <ComplianceDetailPage moduleKey="mca" /> },
        { path: 'mca/:id/edit', element: <ComplianceEditPage moduleKey="mca" /> },
        { path: 'billing/invoices', element: <InvoiceListPage /> },
        { path: 'billing/invoices/new', element: <InvoiceCreatePage /> },
        { path: 'billing/invoices/:id', element: <InvoiceDetailPage /> },
        { path: 'billing/invoices/:id/edit', element: <InvoiceEditPage /> },
        { path: 'billing/expenses', element: <ExpenseListPage /> },
        { path: 'billing/expenses/new', element: <ExpenseCreatePage /> },
        { path: 'billing/expenses/:id', element: <ExpenseDetailPage /> },
        { path: 'billing/expenses/:id/edit', element: <ExpenseEditPage /> },
        { path: 'billing/payments', element: <PaymentListPage /> },
        { path: 'billing/payments/new', element: <PaymentCreatePage /> },
        { path: 'billing/payments/:id', element: <PaymentDetailPage /> },
        { path: 'billing/payments/:id/edit', element: <PaymentEditPage /> },
        { path: 'tasks/my', element: <TasksPage scope="my" /> },
        { path: 'tasks/team', element: <TasksPage scope="team" /> },
        { path: 'tasks/:id', element: <TaskDetailPage /> },
        { path: 'documents', element: <DocumentListPage /> },
        { path: 'documents/upload', element: <DocumentUploadPage /> },
        { path: 'documents/templates', element: <ComingSoon name="Templates" /> },
        { path: 'documents/:id', element: <DocumentDetailPage /> },
        { path: 'documents/:id/edit', element: <DocumentEditPage /> },
        { path: 'staff', element: <AdministrationHomePage /> },
        { path: 'staff/users', element: <UsersPage /> },
        { path: 'staff/users/new', element: <UserCreatePage /> },
        { path: 'staff/users/:id', element: <UserDetailPage /> },
        { path: 'staff/users/:id/edit', element: <UserEditPage /> },
        { path: 'staff/roles', element: <RolesPage /> },
        { path: 'staff/roles/new', element: <RoleCreatePage /> },
        { path: 'staff/roles/:id', element: <RoleDetailPage /> },
        { path: 'staff/roles/:id/edit', element: <RoleEditPage /> },
        { path: 'staff/permissions', element: <PermissionsPage /> },
        { path: 'staff/permissions/:id', element: <PermissionDetailPage /> },
        { path: 'notifications', element: <NotificationListPage /> },
        { path: 'notifications/:id', element: <NotificationDetailPage /> },
        { path: 'reports', element: <ReportsListPage /> },
        { path: 'reports/:type', element: <ReportDetailPage /> },
        { path: 'audit', element: <AuditListPage /> },
        { path: 'audit/:id', element: <AuditDetailPage /> },
        { path: 'settings', children: settingsRoutes },
      ],
    },
  ],
}
