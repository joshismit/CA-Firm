// src/layouts/AppLayout/Sidebar.tsx
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { NAV_GROUPS } from '@/constants/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Scale,
} from 'lucide-react'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === path
    return location.pathname.startsWith(path)
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full border-r transition-all duration-200',
        'bg-[var(--color-sidebar)] border-[var(--color-border)]',
        collapsed ? 'w-14' : 'w-60'
      )}
      style={{ minWidth: collapsed ? '56px' : '240px' }}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 border-b border-[var(--color-border)]',
          'h-14 shrink-0 overflow-hidden'
        )}
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-md)] bg-[var(--color-primary-600)] shrink-0">
          <Scale className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-700 text-[var(--color-text-heading)] leading-tight tracking-tight truncate font-semibold">
              CA Firm ERP
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)] leading-tight tracking-wider uppercase font-medium">
              Enterprise Suite
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-semibold tracking-wider uppercase text-[var(--color-text-muted)]">
                {group.label}
              </p>
            )}
            <ul>
              {group.items.map((item) => {
                const active = isActive(item.path)
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-2.5 h-8 px-2.5 rounded-[var(--radius-md)] mb-0.5',
                        'text-[13px] transition-colors duration-100 relative group',
                        'focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]',
                        active
                          ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-medium'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-body)]',
                        collapsed && 'justify-center px-0'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'shrink-0 transition-colors',
                          collapsed ? 'w-[18px] h-[18px]' : 'w-4 h-4',
                          active ? 'text-[var(--color-primary-600)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'
                        )}
                      />
                      {!collapsed && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {!collapsed && item.badge !== undefined && item.badge > 0 && (
                        <span className={cn(
                          'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1',
                          'text-[10px] font-semibold rounded-full',
                          active
                            ? 'bg-[var(--color-primary-200)] text-[var(--color-primary-800)]'
                            : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                        )}>
                          {item.badge}
                        </span>
                      )}

                      {/* Tooltip on collapsed */}
                      {collapsed && (
                        <span className={cn(
                          'absolute left-full ml-2 px-2 py-1 text-[12px] font-medium whitespace-nowrap',
                          'bg-[var(--color-neutral-900)] text-white rounded-[var(--radius-sm)]',
                          'opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity',
                          'z-[var(--z-tooltip)]'
                        )}>
                          {item.label}
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="ml-1.5 text-[var(--color-primary-300)]">
                              {item.badge}
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="shrink-0 border-t border-[var(--color-border)] p-2">
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center justify-center w-full h-8 rounded-[var(--radius-md)]',
            'text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-body)]',
            'transition-colors duration-100 text-[12px] gap-2'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
