// Shell for the master-admin portal (tenant management, platform-wide settings) - visually distinct from the tenant AppLayout.

import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'

export function MasterAdminLayout() {
  const navigate = useNavigate()
  const admin = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  function handleLogout() {
    logout()
    navigate('/master-admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <header className="h-14 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-neutral-900)] flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-white" />
          <span className="text-[14px] font-semibold text-white">Master Admin</span>
        </div>
        <div className="flex items-center gap-3">
          {admin?.email && <span className="text-[12px] text-white/60">{admin.email}</span>}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-[12px] text-white/70 hover:text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 p-6 max-w-[1280px] mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
