// src/components/feedback/Loading.tsx
// Thin wrapper: renders `fallback` (default: a centered Spinner) while `isLoading`, otherwise `children`.
import type { ReactNode } from 'react'
import { Spinner } from './Spinner'

export interface LoadingProps {
  isLoading: boolean
  children: ReactNode
  fallback?: ReactNode
  className?: string
}

export function Loading({ isLoading, children, fallback, className }: LoadingProps) {
  if (!isLoading) return <>{children}</>
  return <div className={className}>{fallback ?? <Spinner />}</div>
}
