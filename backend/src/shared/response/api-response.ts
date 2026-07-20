import { Request } from 'express';
import { MESSAGES } from '@shared/constants';
import type { ApiResponse, PaginationMeta } from '@shared/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * API Response Helper
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Provides static factory methods for creating standardized API responses.
 *   Controllers MUST use these methods to return data to the client.
 *
 * RESPONSIBILITIES:
 *   - Enforces the `ApiResponse<T>` contract
 *   - Automatically computes `durationMs` if the Express Request is provided
 *   - Extracts `correlationId` from the request
 *   - Centralises standard success messages (created, updated, deleted)
 *
 * USAGE:
 *   res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, data));
 *   res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, data));
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ApiResponseHelper {
  /**
   * Helper to extract standard metadata from the Express Request
   */
  private static getRequestMeta(req?: Request) {
    const timestamp = new Date().toISOString();
    if (!req) return { timestamp };

    const durationMs = req.requestStartTime ? Date.now() - req.requestStartTime : undefined;
    return {
      timestamp,
      correlationId: req.correlationId,
      durationMs,
    };
  }

  /**
   * Generic success response with data
   */
  static success<T>(req: Request, data: T, message: string = MESSAGES.SUCCESS): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      ...this.getRequestMeta(req),
    };
  }

  /**
   * Resource created successfully (201)
   */
  static created<T>(req: Request, data: T, message: string = MESSAGES.CREATED): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      ...this.getRequestMeta(req),
    };
  }

  /**
   * Resource updated successfully (200)
   */
  static updated<T>(req: Request, data: T, message: string = MESSAGES.UPDATED): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      ...this.getRequestMeta(req),
    };
  }

  /**
   * Resource deleted successfully (200)
   */
  static deleted<T>(req: Request, data?: T, message: string = MESSAGES.DELETED): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      ...this.getRequestMeta(req),
    };
  }

  /**
   * Success response for paginated data
   */
  static paginated<T>(
    req: Request,
    data: T[],
    meta: PaginationMeta,
    message: string = MESSAGES.FETCHED,
  ): ApiResponse<T[]> {
    return {
      success: true,
      message,
      data,
      meta,
      ...this.getRequestMeta(req),
    };
  }

  /**
   * Success response with no data payload
   */
  static noContent(req: Request, message: string = MESSAGES.SUCCESS): ApiResponse<null> {
    return {
      success: true,
      message,
      ...this.getRequestMeta(req),
    };
  }

  /**
   * Error response (usually called by the global error middleware)
   */
  static error(
    req: Request | undefined,
    message: string,
    code: string,
    details?: unknown,
  ): ApiResponse<null> {
    return {
      success: false,
      message,
      error: { code, details },
      ...this.getRequestMeta(req),
    };
  }

  /**
   * Build pagination meta from query params and total count
   */
  static buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }
}
