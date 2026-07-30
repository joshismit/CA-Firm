// src/constants/navigation.ts
import {
  LayoutDashboard,
  BarChart3,
  Users,
  UserPlus,
  Briefcase,
  Landmark,
  IdCard,
  Handshake,
  FileText,
  Calculator,
  Receipt,
  Building2,
  CreditCard,
  DollarSign,
  Wallet,
  CheckSquare,
  ClipboardList,
  FolderOpen,
  LayoutTemplate,
  UsersRound,
  Shield,
  KeyRound,
  Settings,
  Bell,
  FileBarChart,
  History,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  badge?: number
}

export interface NavGroup {
  label: string
  items: NavItem[]
  /** Restricts this entire group to users whose `role` is one of these - omit to show to everyone. */
  roles?: string[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Clients',
    items: [
      { label: 'Businesses', path: '/business', icon: Landmark },
      { label: 'Contacts', path: '/contacts', icon: IdCard },
      { label: 'CRM', path: '/crm', icon: Handshake },
      { label: 'All Clients', path: '/clients', icon: Users },
      { label: 'Add Client', path: '/clients/new', icon: UserPlus },
      { label: 'Projects', path: '/projects', icon: Briefcase },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { label: 'GST Returns', path: '/gst', icon: FileText },
      { label: 'Income Tax (ITR)', path: '/itr', icon: Calculator },
      { label: 'TDS / 26Q', path: '/tds', icon: Receipt },
      { label: 'MCA / ROC', path: '/mca', icon: Building2 },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Invoices', path: '/billing/invoices', icon: CreditCard },
      { label: 'Expenses', path: '/billing/expenses', icon: DollarSign },
      { label: 'Payments', path: '/billing/payments', icon: Wallet },
    ],
  },
  {
    label: 'Tasks',
    items: [
      { label: 'My Tasks', path: '/tasks/my', icon: CheckSquare },
      { label: 'Team Tasks', path: '/tasks/team', icon: ClipboardList },
    ],
  },
  {
    label: 'Documents',
    items: [
      { label: 'Vault', path: '/documents', icon: FolderOpen },
      { label: 'Templates', path: '/documents/templates', icon: LayoutTemplate },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Administration', path: '/staff', icon: UsersRound },
      { label: 'Users', path: '/staff/users', icon: Users },
      { label: 'Roles', path: '/staff/roles', icon: Shield },
      { label: 'Permissions', path: '/staff/permissions', icon: KeyRound },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Reports', path: '/reports', icon: FileBarChart },
      { label: 'Audit Logs', path: '/audit', icon: History },
      { label: 'Notifications', path: '/notifications', icon: Bell },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
  {
    label: 'Platform',
    // Same 'MASTER_ADMIN' role literal MasterAdminGuard (routes/master-admin.routes.tsx) already
    // gates on - a tenant user would just hit /403 if this were visible without the filter.
    roles: ['MASTER_ADMIN'],
    items: [{ label: 'Master Admin', path: '/master-admin', icon: ShieldCheck }],
  },
]
