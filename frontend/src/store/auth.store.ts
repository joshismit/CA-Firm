// Authenticated user, session, and permission set - hydrated on login, cleared on logout.
// State shape mirrors the fixed JWT payload the backend's authMiddleware already expects:
// { sub, email, role, tenantId, permissions[] } (backend/src/middlewares/auth.middleware.ts).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from '@/constants/storage-keys.constants'

export interface AuthUser {
  id: string
  email: string
  role: string
  tenantId: string
  permissions: string[]
  firstName?: string
  lastName?: string
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  /** True once persisted state has been read from localStorage - guards against a login-page flash on refresh. */
  hydrated: boolean
  login: (accessToken: string, user: AuthUser) => void
  logout: () => void
}

// zustand's persist middleware reads localStorage synchronously, so its rehydration chain
// resolves synchronously *during* create() - referencing `useAuthStore` from inside
// onRehydrateStorage would hit it before the const binding exists (TDZ). Capturing `set` in
// this closure variable instead sidesteps that, since it's assigned while the creator function
// runs, which happens before rehydration fires.
let setAuthState: (partial: Partial<AuthState>) => void

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => {
      setAuthState = set
      return {
        accessToken: null,
        user: null,
        isAuthenticated: false,
        hydrated: false,
        login: (accessToken, user) => set({ accessToken, user, isAuthenticated: true }),
        logout: () => set({ accessToken: null, user: null, isAuthenticated: false }),
      }
    },
    {
      name: STORAGE_KEYS.AUTH,
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => () => {
        setAuthState({ hydrated: true })
      },
    }
  )
)
