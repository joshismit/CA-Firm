import { ContactRoleType } from '@prisma/client';

/**
 * Response DTO — the shape returned to API clients. Deliberately omits
 * internal-only fields (`tenantId`, `deletedAt`, `aadhaarHash`) that have no
 * value outside the server, or are sensitive (aadhaarHash is a hash, not the
 * raw Aadhaar number, but there is still no reason to ever return it — the
 * frontend's Contact type doesn't include it). Field-for-field match with
 * the frontend's already-built `Contact` type (modules/contacts/types/index.ts).
 */
export interface ContactResponseDto {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  pan: string | null;
  portalUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response DTO for `ContactRole` — the join between a Contact and a Business.
 * `sharePercent` is a Prisma `Decimal` on the model; converted to a plain
 * number here since that's what the frontend's `ContactRole` type expects.
 */
export interface ContactRoleResponseDto {
  id: string;
  businessId: string;
  contactId: string;
  roleType: ContactRoleType;
  customTitle: string | null;
  isPrimary: boolean;
  sharePercent: number | null;
}
