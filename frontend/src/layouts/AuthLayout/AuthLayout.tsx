// Centered, branded shell for login/register/forgot-password/reset-password screens (public routes).
// PRD §4.3 white-label "serving": resolves this hostname's branding (if any tenant has claimed it
// as a subdomain/custom domain) via the one PUBLIC endpoint in the app, and applies it here - the
// pre-login screen itself, not just the authenticated app - before any login has happened. A
// hostname nobody has claimed (the overwhelming common case - the plain platform URL) falls back
// to the default "CA Firm ERP" mark unchanged.

import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Scale } from 'lucide-react'
import { usePublicBrandingQuery } from '@/modules/white-label'

/** CSS custom properties this layout may override for the duration of a white-labeled session - restored on unmount so a claimed hostname's colors never leak into the authenticated app after login (which uses its own layout, not this one, but better to never have set them past this component's lifetime at all). */
const OVERRIDABLE_VARS = ['--color-primary-600', '--color-primary-700'] as const

export function AuthLayout() {
  const { data: branding } = usePublicBrandingQuery(window.location.hostname)

  useEffect(() => {
    if (!branding?.primaryColor) return
    const root = document.documentElement
    const previous = OVERRIDABLE_VARS.map((name) => root.style.getPropertyValue(name))
    root.style.setProperty('--color-primary-600', branding.primaryColor)
    root.style.setProperty('--color-primary-700', branding.accentColor ?? branding.primaryColor)
    return () => {
      OVERRIDABLE_VARS.forEach((name, i) => root.style.setProperty(name, previous[i]))
    }
  }, [branding?.primaryColor, branding?.accentColor])

  const firmName = branding?.firmName ?? 'CA Firm ERP'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-center gap-2 mb-8">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={firmName} className="h-9 max-w-[180px] object-contain" />
          ) : (
            <>
              <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-600)] flex items-center justify-center">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <span className="text-[16px] font-semibold text-[var(--color-text-heading)]">{firmName}</span>
            </>
          )}
        </div>
        <Outlet />
      </div>
    </div>
  )
}
