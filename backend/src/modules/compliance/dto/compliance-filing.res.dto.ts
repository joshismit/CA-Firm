import { ComplianceFilingStatus } from '@prisma/client';

/**
 * Response DTO — field-for-field match with the frontend's already-built
 * `ComplianceFiling` type (frontend/src/modules/compliance/types/index.ts).
 * Deliberately omits `category`/`tenantId` — the frontend never reads
 * either (which category a filing belongs to is implied by which of the
 * four mounted routes — /gst, /itr, /tds, /mca — the caller used, not a
 * response field).
 */
export interface ComplianceFilingResponseDto {
  id: string;
  reference: string;
  period: string;
  status: ComplianceFilingStatus;
  dueDate: string | null;
  filedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
