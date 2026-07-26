// src/layouts/AppLayout/AppLayout.tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { CommandPalette } from '@/components/navigation'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Sidebar */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main
          className={cn(
            'flex-1 overflow-y-auto',
            'bg-[var(--color-bg)]'
          )}
          id="main-content"
          tabIndex={-1}
        >
          <div className="min-h-full p-6 max-w-[1280px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  )
}
