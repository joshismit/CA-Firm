// auth API request functions, built on the shared Axios instance from src/services/axios.ts.
// Every function below hits the real, mounted backend (backend/src/modules/auth/routes/
// auth.routes.ts) - login/refresh/logout are no longer a client-side fixture.

import { apiClient } from '@/services/axios'
import type { ApiError } from '@/services/api-error'
import type { ApiResponse } from '@/types/api.types'
import type {
  AcceptInviteRequest,
  AuthMeResponse,
  AuthSession,
  ChangePasswordPayload,
  ForgotPasswordRequest,
  InviteInfo,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegisterRequest,
  ResetPasswordRequest,
} from '../types'

export async function loginRequest(credentials: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials)
  return data.data
}

/** One-time-use rotation: the backend issues a new refreshToken on every call and invalidates the
 * one just spent - callers must persist the new refreshToken, never reuse the old one. */
export async function refreshTokenRequest(payload: RefreshTokenRequest): Promise<RefreshTokenResponse> {
  const { data } = await apiClient.post<ApiResponse<RefreshTokenResponse>>('/auth/refresh', payload)
  return data.data
}

export async function logoutRequest(payload: LogoutRequest): Promise<void> {
  await apiClient.post('/auth/logout', payload)
}

export async function getMe(): Promise<AuthMeResponse> {
  const { data } = await apiClient.get<ApiResponse<AuthMeResponse>>('/auth/me')
  return data.data
}

export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await apiClient.post('/auth/change-password', payload)
}

export async function listSessions(): Promise<AuthSession[]> {
  const { data } = await apiClient.get<ApiResponse<AuthSession[]>>('/auth/sessions')
  return data.data
}

export async function revokeSession(id: string): Promise<void> {
  await apiClient.delete(`/auth/sessions/${id}`)
}

// ─── NOT YET AVAILABLE (no register/forgot-password/reset-password/invite backend routes exist) ──
// Same notImplemented()/ApiError(501) shape as every other stub module (see modules/compliance/
// api/index.ts). No mock success, no guessed endpoint path beyond the plausible base already
// implied by this app's own route naming (/register, /forgot-password, /reset-password, /invite).

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `This isn't available yet (${action}).`,
  } satisfies ApiError
}

// TODO: POST /auth/register
export async function registerRequest(_payload: RegisterRequest): Promise<void> {
  return notImplemented('registerRequest')
}

// TODO: POST /auth/forgot-password
export async function forgotPasswordRequest(_payload: ForgotPasswordRequest): Promise<void> {
  return notImplemented('forgotPasswordRequest')
}

// TODO: POST /auth/reset-password
export async function resetPasswordRequest(_payload: ResetPasswordRequest): Promise<void> {
  return notImplemented('resetPasswordRequest')
}

// TODO: GET /auth/invite/:token
export async function getInviteInfo(_token: string): Promise<InviteInfo> {
  return notImplemented('getInviteInfo')
}

// TODO: POST /auth/invite/:token/accept
export async function acceptInviteRequest(_payload: AcceptInviteRequest): Promise<void> {
  return notImplemented('acceptInviteRequest')
}
