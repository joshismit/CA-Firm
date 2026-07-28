/**
 * Response DTO — the shape returned to API clients. Deliberately omits
 * internal-only fields (`tenantId`, `deletedAt`, `deletedBy`) that have no
 * value outside the server; dates are serialised to ISO strings rather than
 * leaking Prisma `Date` objects. Field-for-field match with the frontend's
 * already-built `Lead` type (modules/crm/types/index.ts) — no `isConverted`/
 * `status` field is added even though it would be easy to compute, since the
 * frontend's locked type doesn't expose one; conversion state is represented
 * by the existence of a `LeadConversion` row, not a field on Lead itself.
 */
export interface LeadResponseDto {
  id: string;
  businessId: string | null;
  contactId: string | null;
  title: string;
  sourceId: string;
  stageId: string;
  expectedRevenue: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response DTO for `LeadStage` — matches the frontend's `LeadStage` type exactly. */
export interface LeadStageResponseDto {
  id: string;
  name: string;
  order: number;
}
