// Subscribes to a CSS media query for responsive conditional rendering.
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query)
    const listener = () => setMatches(mediaQueryList.matches)

    listener()
    mediaQueryList.addEventListener('change', listener)
    return () => mediaQueryList.removeEventListener('change', listener)
  }, [query])

  return matches
}

/** Breakpoints matching this app's Tailwind config (sm/md/lg/xl) - reuse instead of hand-rolling query strings. */
export const BREAKPOINTS = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1400px)',
} as const
