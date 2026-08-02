// auth API request functions, built on the shared Axios instance from src/services/axios.ts.
// Every function below hits the real, mounted backend (backend/src/modules/auth/routes/
// auth.routes.ts). No self-service registerRequest() - accounts are provisioned via invitation
// only (see modules/master-admin's createTenant flow and acceptInviteRequest below).

import { apiClient } from '@/services/axios'
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

export async function forgotPasswordRequest(payload: ForgotPasswordRequest): Promise<void> {
  await apiClient.post('/auth/forgot-password', payload)
}

export async function resetPasswordRequest(payload: ResetPasswordRequest): Promise<void> {
  await apiClient.post('/auth/reset-password', payload)
}

export async function getInviteInfo(token: string): Promise<InviteInfo> {
  const { data } = await apiClient.get<ApiResponse<InviteInfo>>(`/auth/invite/${token}`)
  return data.data
}

export async function acceptInviteRequest(payload: AcceptInviteRequest): Promise<void> {
  const { token, ...body } = payload
  await apiClient.post(`/auth/invite/${token}/accept`, body)
}
