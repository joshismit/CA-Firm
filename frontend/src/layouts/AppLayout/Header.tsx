// src/layouts/AppLayout/Header.tsx
import { useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn, getInitials } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/store/auth.store'
import { useUiStore } from '@/store/ui.store'
import { Breadcrumb } from '@/components/navigation'
import { useNotificationsQuery } from '@/modules/notifications/hooks'
import { useLogoutMutation } from '@/modules/auth/hooks'
import {
  Search,
  Sun,
  Moon,
  Bell,
  Settings,
  LogOut,
  User,
  HelpCircle,
  Menu,
} from 'lucide-react'

export interface HeaderProps {
  /** Only rendered below the md breakpoint - opens the mobile Sidebar drawer (see AppLayout.tsx). */
  onOpenMobileNav?: () => void
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logoutMutation = useLogoutMutation()
  const setCommandMenuOpen = useUiStore((s) => s.setCommandMenuOpen)
  // Real query, not a hardcoded badge - there's no notifications backend yet, so this genuinely
  // errors and the unread dot simply never renders rather than showing a fabricated count.
  const unreadQuery = useNotificationsQuery({ page: 1, limit: 1, unreadOnly: true })
  const unreadCount = unreadQuery.data?.meta.total ?? 0

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    : ''
  const initials = user ? getInitials(displayName) : ''

  const handleSignOut = () => {
    logoutMutation.mutate()
  }

  return (
    <header
      className={cn(
        'flex items-center gap-4 px-6 h-14 shrink-0',
        'bg-[var(--color-sidebar)] border-b border-[var(--color-border)]',
        'sticky top-0 z-[var(--z-sticky)]'
      )}
    >
      {/* Mobile nav trigger - hidden at md+ where the persistent Sidebar takes over. */}
      {onOpenMobileNav && (
        <button
          onClick={onOpenMobileNav}
          className={cn(
            'md:hidden flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] shrink-0',
            'text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-body)]',
            'transition-colors duration-100'
          )}
          aria-label="Open navigation menu"
        >
          <Menu className="w-4.5 h-4.5" />
        </button>
      )}

      {/* Breadcrumb */}
      <div className="flex-1 flex items-center min-w-0">
        <Breadcrumb />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* Search trigger */}
        <button
          onClick={() => setCommandMenuOpen(true)}
          className={cn(
            'flex items-center gap-2 h-8 px-3 rounded-[var(--radius-md)]',
            'text-[12px] text-[var(--color-text-muted)] border border-[var(--color-border)]',
            'hover:bg-[var(--color-hover)] hover:text-[var(--color-text-body)]',
            'transition-colors duration-100'
          )}
          aria-label="Open search (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Search...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-mono rounded bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
            ⌘K
          </kbd>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)]',
            'text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-body)]',
            'transition-colors duration-100'
          )}
          aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
        >
          {resolvedTheme === 'light' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className={cn(
            'relative flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)]',
            'text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-body)]',
            'transition-colors duration-100'
          )}
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-danger)] border-2 border-[var(--color-sidebar)]" />
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />

        {/* User menu - Radix DropdownMenu (same primitive as DataTableColumnToggle) rather than a
            hover-only div: click/keyboard-openable, focus-trapped, Escape-to-close, and usable on
            touch devices where ":hover" never fires. */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={cn(
                'flex items-center gap-2 h-8 pl-1 pr-2 rounded-[var(--radius-md)]',
                'hover:bg-[var(--color-hover)] transition-colors duration-100',
                'data-[state=open]:bg-[var(--color-hover)]'
              )}
              aria-label="User menu"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-700)] flex items-center justify-center shrink-0">
                <span className="text-[10px] font-semibold text-white">{initials}</span>
              </div>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-[12px] font-medium text-[var(--color-text-body)] leading-tight">
                  {displayName}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] leading-tight">
                  {user?.role ?? ''}
                </span>
              </div>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className={cn(
                'w-48 py-1',
                'bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-lg)]',
                'shadow-[var(--shadow-lg)] z-[var(--z-dropdown)]'
              )}
            >
              {[
                { icon: User, label: 'Profile', path: '/settings/profile' },
                { icon: Settings, label: 'Settings', path: '/settings' },
                { icon: HelpCircle, label: 'Help & Support', path: '/help' },
              ].map(({ icon: Icon, label, path }) => (
                <DropdownMenu.Item
                  key={label}
                  onSelect={() => navigate(path)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 text-[13px] cursor-pointer outline-none',
                    'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-body)]',
                    'data-[highlighted]:bg-[var(--color-hover)] data-[highlighted]:text-[var(--color-text-body)]',
                    'transition-colors duration-100'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="my-1 border-t border-[var(--color-border)]" />
              <DropdownMenu.Item
                onSelect={handleSignOut}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 text-[13px] cursor-pointer outline-none',
                  'text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]',
                  'data-[highlighted]:bg-[var(--color-danger-bg)]',
                  'transition-colors duration-100'
                )}
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
