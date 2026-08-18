// Request/response interceptors: auth token attach, silent refresh-and-retry on 401, global error
// normalization.
//
// POST /auth/refresh rotates the refresh token on every call (one-time use - reusing a spent token
// signals theft and the backend revokes the whole session, see backend/src/modules/auth/service/
// auth.service.ts's refresh()). If two requests 401 at the same moment, they must NOT each call
// /auth/refresh independently - the second call would present an already-spent token and trip the
// reuse-detection wipe. `refreshPromise` below is a module-level in-flight guard so concurrent 401s
// share exactly one refresh call.

import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { apiClient } from './axios'
import { normalizeApiError } from './api-error'
import { useAuthStore } from '@/store/auth.store'
import type { ApiResponse } from '@/types/api.types'
import type { RefreshTokenResponse } from '@/modules/auth/types'

let attached = false
let refreshPromise: Promise<string> | null = null

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

function hardLogout() {
  useAuthStore.getState().logout()
  // Axios interceptors run outside React Router context, so a plain window event is used -
  // AppProviders listens for this and navigates to /login.
  window.dispatchEvent(new CustomEvent('auth:unauthorized'))
}

/** Ensures only one /auth/refresh call is ever in flight - later callers await the same promise. */
function refreshAccessToken(client: typeof apiClient): Promise<string> {
  if (refreshPromise) return refreshPromise

  const { refreshToken } = useAuthStore.getState()
  if (!refreshToken) return Promise.reject(new Error('No refresh token available'))

  refreshPromise = client
    .post<ApiResponse<RefreshTokenResponse>>('/auth/refresh', { refreshToken })
    .then(({ data }) => {
      useAuthStore.getState().setTokens(data.data.accessToken, data.data.refreshToken)
      return data.data.accessToken
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

export function attachInterceptors(client = apiClient) {
  if (attached) return
  attached = true

  client.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const apiError = normalizeApiError(error)
      const config = error.config as RetryableConfig | undefined
      const isAuthEndpoint = config?.url === '/auth/login' || config?.url === '/auth/refresh'

      // Silent refresh-and-retry: only for a real session (was authenticated), only once per
      // request (`_retried` guard - a 401 on the retried request means refresh itself didn't fix
      // things, so fall through to hard logout instead of looping), and never for the auth
      // endpoints themselves (a 401 from /auth/login is just "wrong password", not an expired
      // session; refreshing wouldn't make sense here in the first place).
      if (
        config &&
        apiError.status === 401 &&
        !isAuthEndpoint &&
        !config._retried &&
        useAuthStore.getState().isAuthenticated &&
        useAuthStore.getState().refreshToken
      ) {
        try {
          await refreshAccessToken(client)
          config._retried = true
          return client(config)
        } catch {
          hardLogout()
          return Promise.reject(apiError)
        }
      }

      if (apiError.status === 401 && useAuthStore.getState().isAuthenticated) {
        hardLogout()
      }

      return Promise.reject(apiError)
    }
  )
}

export function bootstrapHttp() {
  attachInterceptors(apiClient)
}
