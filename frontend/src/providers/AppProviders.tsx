// Composes all app-wide providers (QueryProvider, ThemeProvider, Toaster) into a single wrapper mounted in main.tsx.
// A global Radix TooltipProvider is deliberately not added here - components/ui/tooltip.tsx already
// wraps each Tooltip instance in its own Provider, so a second one would just be redundant nesting.

import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { QueryProvider } from './QueryProvider'
import { ThemeProvider } from '@/contexts/ThemeContext'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        {children}
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryProvider>
  )
}
