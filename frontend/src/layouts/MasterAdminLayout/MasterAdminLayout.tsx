// Shell for the master-admin portal (tenant management, platform-wide settings) - visually distinct from the tenant AppLayout.

import { Outlet } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

export function MasterAdminLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <header className="h-14 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-neutral-900)] flex items-center px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-white" />
          <span className="text-[14px] font-semibold text-white">Master Admin</span>
        </div>
      </header>
      <main className="flex-1 p-6 max-w-[1280px] mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
