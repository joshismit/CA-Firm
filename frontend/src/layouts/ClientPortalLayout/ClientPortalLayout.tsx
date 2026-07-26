// Minimal shell for the external client-facing portal (document sharing, e-signatures) - no internal CA-firm navigation.

import { Outlet } from 'react-router-dom'
import { Scale } from 'lucide-react'

export function ClientPortalLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <header className="h-14 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-card)] flex items-center px-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--color-primary-600)] flex items-center justify-center">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <span className="text-[14px] font-semibold text-[var(--color-text-heading)]">Client Portal</span>
        </div>
      </header>
      <main className="flex-1 p-6 max-w-[1280px] mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
