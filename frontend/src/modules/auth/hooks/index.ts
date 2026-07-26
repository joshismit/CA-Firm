// auth-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useTenantStore } from '@/store/tenant.store'
import { loginRequest } from '../api'

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
