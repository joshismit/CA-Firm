// src/modules/settings/components/SettingsNav.tsx
// Persistent cross-page navigation strip shown on every settings/* page - the 5 sections are
// siblings under one route prefix, so jumping between them is common enough to justify one shared
// nav component (matches this app's existing underline-tab visual language, just routing-driven
// via NavLink instead of local state like the stateful <Tabs> component).
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const SETTINGS_NAV_ITEMS = [
  { to: '/settings', label: 'Overview', end: true },
  { to: '/settings/profile', label: 'Profile' },
  { to: '/settings/firm', label: 'Firm' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/team', label: 'Team' },
  { to: '/settings/white-label', label: 'White Label' },
  { to: '/settings/integrations', label: 'Integrations' },
  { to: '/settings/dashboard-defaults', label: 'Dashboard Defaults' },
]

export function SettingsNav() {
  return (
    <nav className="flex items-center gap-1 border-b border-[var(--color-border)] overflow-x-auto" aria-label="Settings sections">
      {SETTINGS_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              '-mb-px inline-flex h-[34px] shrink-0 items-center gap-1.5 border-b-2 px-3',
              'text-[13px] font-medium transition-colors duration-150',
              isActive
                ? 'border-[var(--color-primary-600)] text-[var(--color-primary-700)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)]'
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
