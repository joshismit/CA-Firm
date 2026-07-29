// auth-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '@/services/query-keys'
import { useAuthStore } from '@/store/auth.store'
import { useTenantStore } from '@/store/tenant.store'
import { changePassword, getMe, listSessions, loginRequest, revokeSession } from '../api'
import type { ChangePasswordPayload } from '../types'

export function useLoginMutation() {
  const login = useAuthStore((s) => s.login)
  const setTenant = useTenantStore((s) => s.setTenant)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => {
      login(data.accessToken, data.user)
      setTenant(data.tenant)
      navigate('/dashboard', { replace: true })
    },
  })
}

// Real endpoint (GET /auth/me) - not a NOT_IMPLEMENTED stub.
export function useMeQuery() {
  return useQuery({ queryKey: queryKeys.auth.me, queryFn: getMe })
}

// Real endpoint (GET /auth/sessions) - not a NOT_IMPLEMENTED stub.
export function useSessionsQuery() {
  return useQuery({ queryKey: queryKeys.auth.sessions, queryFn: listSessions })
}

// Real endpoint (DELETE /auth/sessions/:id) - not a NOT_IMPLEMENTED stub.
export function useRevokeSessionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.auth.sessions }),
  })
}

// Real endpoint (POST /auth/change-password) - not a NOT_IMPLEMENTED stub. The backend revokes
// every session (including this one) on a successful change, so the frontend logs out and sends
// the user back to /login rather than pretending the current session is still valid.
export function useChangePasswordMutation() {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changePassword(payload),
    onSuccess: () => {
      logout()
      navigate('/login', { replace: true })
    },
  })
}
