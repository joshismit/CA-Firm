// src/layouts/AppLayout/Header.tsx
import { useNavigate } from 'react-router-dom'
import { cn, getInitials } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/store/auth.store'
import { useUiStore } from '@/store/ui.store'
import { Breadcrumb } from '@/components/navigation'
import {
  Search,
  Sun,
  Moon,
  Bell,
  Settings,
  LogOut,
  User,
  HelpCircle,
} from 'lucide-react'

export function Header() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setCommandMenuOpen = useUiStore((s) => s.setCommandMenuOpen)

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    : ''
  const initials = user ? getInitials(displayName) : ''

  const handleSignOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header
      className={cn(
        'flex items-center gap-4 px-6 h-14 shrink-0',
        'bg-[var(--color-sidebar)] border-b border-[var(--color-border)]',
        'sticky top-0 z-[var(--z-sticky)]'
      )}
    >
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
          className={cn(
            'relative flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)]',
            'text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-body)]',
            'transition-colors duration-100'
          )}
          aria-label="Notifications (2 unread)"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-danger)] border-2 border-[var(--color-sidebar)]" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />

        {/* User menu */}
        <div className="relative group">
          <button
            className={cn(
              'flex items-center gap-2 h-8 pl-1 pr-2 rounded-[var(--radius-md)]',
              'hover:bg-[var(--color-hover)] transition-colors duration-100'
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

          {/* Dropdown */}
          <div className={cn(
            'absolute right-0 top-full mt-1 w-48 py-1',
            'bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-lg)]',
            'shadow-[var(--shadow-lg)]',
            'opacity-0 invisible group-hover:opacity-100 group-hover:visible',
            'transition-all duration-150 z-[var(--z-dropdown)]'
          )}>
            {[
              { icon: User, label: 'Profile' },
              { icon: Settings, label: 'Settings' },
              { icon: HelpCircle, label: 'Help & Support' },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 text-[13px]',
                  'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-body)]',
                  'transition-colors duration-100'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
            <div className="my-1 border-t border-[var(--color-border)]" />
            <button
              onClick={handleSignOut}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 text-[13px]',
                'text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]',
                'transition-colors duration-100'
              )}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
