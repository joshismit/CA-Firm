import { HTTP_STATUS } from '@shared/constants/http-status';

/**
 * Standardized API response wrapper.
 * ALL responses from this API use this format — success and error.
 */

export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  error?: ApiErrorDetail;
  correlationId?: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiErrorDetail {
  code: string;
  details?: unknown;
}

/**
 * Response helper functions.
 * Use these in controllers to return consistent responses.
 */
export const ApiResponseHelper = {
  /**
   * Success response with data
   */
  success<T>(message: string, data: T, correlationId?: string): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      correlationId,
    };
  },

  /**
   * Success response for paginated data
   */
  paginated<T>(
    message: string,
    data: T[],
    meta: PaginationMeta,
    correlationId?: string,
  ): ApiResponse<T[]> {
    return {
      success: true,
      message,
      data,
      meta,
      timestamp: new Date().toISOString(),
      correlationId,
    };
  },

  /**
   * Success response with no data (204-like)
   */
  noContent(message: string, correlationId?: string): ApiResponse<null> {
    return {
      success: true,
      message,
      timestamp: new Date().toISOString(),
      correlationId,
    };
  },

  /**
   * Error response
   */
  error(
    message: string,
    code: string,
    details?: unknown,
    correlationId?: string,
  ): ApiResponse<null> {
    return {
      success: false,
      message,
      error: { code, details },
      timestamp: new Date().toISOString(),
      correlationId,
    };
  },

  /**
   * Build pagination meta from query params and total count
   */
  buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  },
};
