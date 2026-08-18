// src/layouts/AppLayout/AppLayout.tsx
// Below the md breakpoint the persistent Sidebar rail would squeeze page content into an unusable
// sliver, so it's hidden entirely and replaced by a Header hamburger trigger that opens the same
// Sidebar (variant="mobile") inside the existing Drawer primitive (components/ui/drawer.tsx) -
// same nav-rendering component either way, no duplicate implementation.
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { CommandPalette } from '@/components/navigation'
import { DrawerRoot, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Sidebar - desktop rail only, hidden below md */}
      <div className="hidden md:block h-full">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </div>

      {/* Sidebar - mobile drawer */}
      <DrawerRoot open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DrawerContent side="left" size="sm" className="p-0">
          {/* Visually hidden - DrawerContent requires a DrawerTitle for screen readers, the visible
              "CA Firm ERP" wordmark inside Sidebar already serves as the visual title. */}
          <DrawerTitle className="sr-only">Navigation</DrawerTitle>
          <Sidebar
            collapsed={false}
            onToggle={() => setMobileNavOpen(false)}
            variant="mobile"
            onNavigate={() => setMobileNavOpen(false)}
          />
        </DrawerContent>
      </DrawerRoot>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <Header onOpenMobileNav={() => setMobileNavOpen(true)} />

        {/* Page content */}
        <main
          className={cn(
            'flex-1 overflow-y-auto',
            'bg-[var(--color-bg)]'
          )}
          id="main-content"
          tabIndex={-1}
        >
          <div className="min-h-full p-4 sm:p-6 max-w-[1280px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  )
}
