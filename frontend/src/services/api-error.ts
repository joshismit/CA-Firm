// Shared ApiError shape and helpers for normalizing Axios errors into a consistent app-level error object.
// Mock modules throw a plain object matching ApiError directly (no Axios involved), so
// normalizeApiError accepts either shape and always returns the same ApiError for callers.

import { isAxiosError } from 'axios'
import type { ApiErrorEnvelope } from '@/types/api.types'

export interface ApiError {
  status: number
  code: string
  message: string
  fieldErrors?: Record<string, string>
  /** Raw `error.details` from the response envelope when it isn't the field-errors array shape above (e.g. a 409's structured conflict payload). */
  details?: unknown
}

function isApiErrorShape(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'code' in error &&
    'message' in error
  )
}

export function normalizeApiError(error: unknown): ApiError {
  if (isAxiosError<ApiErrorEnvelope>(error)) {
    const envelope = error.response?.data
    const details = envelope?.error?.details
    const fieldErrors = Array.isArray(details)
      ? details.reduce<Record<string, string>>((acc, d) => {
          if (d && typeof d === 'object' && 'field' in d && 'message' in d) {
            acc[String(d.field)] = String(d.message)
          }
          return acc
        }, {})
      : undefined

    return {
      status: error.response?.status ?? 0,
      code: envelope?.error?.code ?? (error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR'),
      message: envelope?.message ?? error.message ?? 'Something went wrong. Please try again.',
      fieldErrors,
      details,
    }
  }

  if (isApiErrorShape(error)) {
    return error
  }

  return {
    status: 0,
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
  }
}
