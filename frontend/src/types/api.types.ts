// Shared API envelope types (PaginatedResponse<T>, ApiError, ApiResponse<T>).
// Matches the backend's ApiResponseHelper envelope exactly (backend/src/shared/response/api-response.ts).

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface ApiSuccessResponse<T> {
  success: true
  message: string
  data: T
  meta?: PaginationMeta
  timestamp: string
  correlationId?: string
  durationMs?: number
}

export interface ApiErrorEnvelope {
  success: false
  message: string
  error: {
    code: string
    details?: Array<{ field: string; message: string }> | unknown
  }
  timestamp: string
  correlationId?: string
}

export type ApiResponse<T> = ApiSuccessResponse<T>

export type PaginatedResponse<T> = ApiSuccessResponse<T[]> & { meta: PaginationMeta }
