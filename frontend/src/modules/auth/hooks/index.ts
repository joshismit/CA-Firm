// auth-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '@/services/query-keys'
import { useAuthStore } from '@/store/auth.store'
import { useTenantStore } from '@/store/tenant.store'
import {
  acceptInviteRequest,
  changePassword,
  forgotPasswordRequest,
  getInviteInfo,
  getMe,
  listSessions,
  loginRequest,
  logoutRequest,
  registerRequest,
  resetPasswordRequest,
  revokeSession,
} from '../api'
import type {
  AcceptInviteRequest,
  ChangePasswordPayload,
  ForgotPasswordRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from '../types'

export function useLoginMutation() {
  const login = useAuthStore((s) => s.login)
  const setTenant = useTenantStore((s) => s.setTenant)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => {
      login(data.accessToken, data.refreshToken, data.user)
      setTenant(data.tenant)
      navigate('/dashboard', { replace: true })
    },
  })
}

/** Best-effort: revokes the session server-side, but clears local state and navigates to /login
 * regardless of whether the request succeeds (a network failure shouldn't trap the user in a
 * "signed in" state they can no longer act on). */
export function useLogoutMutation() {
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      if (refreshToken) await logoutRequest({ refreshToken }).catch(() => undefined)
    },
    onSettled: () => {
      logout()
      navigate('/login', { replace: true })
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

// `retry: false` below - every one of these genuinely 501s today (see api/index.ts), no point
// retry-storming a guaranteed failure.

export function useRegisterMutation() {
  return useMutation({ mutationFn: (payload: RegisterRequest) => registerRequest(payload) })
}

export function useForgotPasswordMutation() {
  return useMutation({ mutationFn: (payload: ForgotPasswordRequest) => forgotPasswordRequest(payload) })
}

export function useResetPasswordMutation() {
  return useMutation({ mutationFn: (payload: ResetPasswordRequest) => resetPasswordRequest(payload) })
}

export function useInviteInfoQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.auth.invite(token),
    queryFn: () => getInviteInfo(token),
    enabled: !!token,
    retry: false,
  })
}

export function useAcceptInviteMutation() {
  return useMutation({ mutationFn: (payload: AcceptInviteRequest) => acceptInviteRequest(payload) })
}
