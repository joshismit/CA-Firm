// Request/response interceptors: auth token attach, tenant-inactive/401 handling, global error normalization.
// There is no refresh-token endpoint implemented on the backend yet, so a 401 is always treated as a
// hard logout + redirect - no silent refresh-and-retry loop is built here (nothing exists to call).

import type { AxiosError } from 'axios'
import { apiClient } from './axios'
import { normalizeApiError } from './api-error'
import { useAuthStore } from '@/store/auth.store'

let attached = false

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
    (error: AxiosError) => {
      const apiError = normalizeApiError(error)

      if (apiError.status === 401 && useAuthStore.getState().isAuthenticated) {
        useAuthStore.getState().logout()
        // Axios interceptors run outside React Router context, so a plain window
        // event is used - AppProviders listens for this and navigates to /login.
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      }

      return Promise.reject(apiError)
    }
  )
}

export function bootstrapHttp() {
  attachInterceptors(apiClient)
}
