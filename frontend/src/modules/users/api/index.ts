// users API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: backend/src/modules has no `users` module (no routes mounted in
// backend/src/app.ts), even though the User/UserInvitation Prisma models are fully defined.
// Every function below is a typed placeholder - wire the real apiClient call once the backend
// implements it. No mock data, no guessed endpoint path.

import type { ApiError } from '@/services/api-error'
import type { PaginatedResponse } from '@/types/api.types'
import type { InviteUserPayload, UpdateUserPayload, User, UserInvitation, UserListFilters } from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Users API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /api/v1/users
export async function listUsers(_filters: UserListFilters): Promise<PaginatedResponse<User>> {
  return notImplemented('listUsers')
}

// TODO: GET /api/v1/users/:id
export async function getUser(_id: string): Promise<User> {
  return notImplemented('getUser')
}

// TODO: POST /api/v1/users/invite
export async function inviteUser(_payload: InviteUserPayload): Promise<UserInvitation> {
  return notImplemented('inviteUser')
}

// TODO: PATCH /api/v1/users/:id
export async function updateUser(_id: string, _payload: UpdateUserPayload): Promise<User> {
  return notImplemented('updateUser')
}

// TODO: DELETE /api/v1/users/:id
export async function deleteUser(_id: string): Promise<void> {
  return notImplemented('deleteUser')
}

// TODO: POST /api/v1/users/invitations/:id/resend
export async function resendInvitation(_invitationId: string): Promise<void> {
  return notImplemented('resendInvitation')
}

// TODO: DELETE /api/v1/users/invitations/:id
export async function revokeInvitation(_invitationId: string): Promise<void> {
  return notImplemented('revokeInvitation')
}
