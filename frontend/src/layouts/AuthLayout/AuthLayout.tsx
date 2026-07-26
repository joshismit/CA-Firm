// Centered, branded shell for login/register/forgot-password/reset-password screens (public routes).

import { Outlet } from 'react-router-dom'
import { Scale } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-600)] flex items-center justify-center">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <span className="text-[16px] font-semibold text-[var(--color-text-heading)]">CA Firm ERP</span>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
