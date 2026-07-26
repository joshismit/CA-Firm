// src/constants/navigation.ts
import {
  LayoutDashboard,
  BarChart3,
  Users,
  UserPlus,
  Briefcase,
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
  Settings,
  Bell,
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
      { label: 'All Clients', path: '/clients', icon: Users },
      { label: 'Add Client', path: '/clients/new', icon: UserPlus },
      { label: 'Projects', path: '/projects', icon: Briefcase },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { label: 'GST Returns', path: '/gst', icon: FileText, badge: 3 },
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
      { label: 'My Tasks', path: '/tasks/my', icon: CheckSquare, badge: 5 },
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
    label: 'Staff',
    items: [
      { label: 'Team', path: '/staff', icon: UsersRound },
      { label: 'Roles & Permissions', path: '/staff/roles', icon: Shield },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Notifications', path: '/notifications', icon: Bell, badge: 2 },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
]
