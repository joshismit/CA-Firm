import { BusinessStatus } from '@prisma/client';

/**
 * Response DTO — the shape returned to API clients. Deliberately omits
 * internal-only fields (`tenantId`, `deletedAt`, `deletedBy`, `createdBy`)
 * that have no value outside the server; dates are serialised to ISO strings
 * rather than leaking Prisma `Date` objects. Field-for-field match with the
 * frontend's already-built `Business` type (modules/business/types/index.ts).
 */
export interface BusinessResponseDto {
  id: string;
  typeId: string;
  name: string;
  legalName: string | null;
  status: BusinessStatus;
  pan: string | null;
  gstin: string | null;
  cin: string | null;
  incorporationDate: string | null;
  financialYearStart: number;
  industry: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response DTO for `BusinessType` — the reference/lookup table `Business.typeId`
 * points at. Matches the frontend's `BusinessType` type exactly.
 */
export interface BusinessTypeResponseDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}
