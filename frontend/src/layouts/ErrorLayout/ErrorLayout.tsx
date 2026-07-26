// Bare shell used by 404/401/403/500 pages - no sidebar, no auth-dependent chrome.

import type { ReactNode } from 'react'

export function ErrorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      {children}
    </div>
  )
}
