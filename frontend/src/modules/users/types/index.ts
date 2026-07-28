// TypeScript types and interfaces scoped to users.
// Field shapes mirror the User/UserInvitation Prisma models (backend/prisma/schema.prisma) - the
// backend has a full schema for this but no mounted routes yet.

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'SUSPENDED' | 'DELETED'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  status: UserStatus
  isOwner: boolean
  avatarStorageKey: string | null
  jobTitle: string | null
  lastLoginAt: string | null
  createdAt: string
}

export interface UserListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: UserStatus
}

export interface InviteUserPayload {
  email: string
  firstName?: string
  lastName?: string
  roleIds: string[]
  message?: string
}

export interface UpdateUserPayload {
  firstName?: string
  lastName?: string
  phone?: string
  jobTitle?: string
  status?: UserStatus
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'

export interface UserInvitation {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}
