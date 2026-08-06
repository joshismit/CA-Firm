import { LeadPriority } from '@prisma/client';

/**
 * Response DTO — the shape returned to API clients. Deliberately omits
 * internal-only fields (`tenantId`, `deletedAt`, `deletedBy`) that have no
 * value outside the server; dates are serialised to ISO strings rather than
 * leaking Prisma `Date` objects. Was originally a field-for-field match with
 * the frontend's `Lead` type (modules/crm/types/index.ts); `interestedServices`
 * and the 5 `proposal*` fields (PRD §8.2/§8.4) are new backend-only additions
 * the frontend type doesn't consume yet — additive, so existing clients are
 * unaffected. No `isConverted`/`status` field is added even though it would
 * be easy to compute, since conversion state is represented by the existence
 * of a `LeadConversion` row, not a field on Lead itself.
 */
export interface LeadResponseDto {
  id: string;
  businessId: string | null;
  contactId: string | null;
  title: string;
  sourceId: string;
  stageId: string;
  priority: LeadPriority | null;
  expectedRevenue: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  interestedServices: string[];
  proposalSentAt: string | null;
  proposalAcceptedAt: string | null;
  proposalRejectedAt: string | null;
  proposalValue: number | null;
  proposalRemarks: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response DTO for `LeadStage` — matches the frontend's `LeadStage` type exactly. */
export interface LeadStageResponseDto {
  id: string;
  name: string;
  order: number;
}

/** PRD §8.6 — a chronological CRM note (author/date/content/optional attachment). */
export interface LeadNoteResponseDto {
  id: string;
  leadId: string;
  authorId: string;
  content: string;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** PRD §8.5 — a staff member assigned to a pre-conversion Lead. `isPrimary` marks the "lead owner" (PRD §8.4). */
export interface LeadAssignmentResponseDto {
  id: string;
  leadId: string;
  userId: string;
  isPrimary: boolean;
  assignedAt: string;
}

/** PRD §8.10 — CRM dashboard counts (`GET /crm/dashboard`). */
export interface LeadDashboardResponseDto {
  totalLeads: number;
  /** Sent, and neither accepted nor rejected yet. */
  activeProposals: number;
  /** `Client.status` in ACTIVE/INACTIVE/SUSPENDED — reuses `Client`, not a separate counter. */
  convertedClients: number;
  /** `Client.status = FORMER` — the decision to reuse `Client.status` rather than add a dedicated archived flag. */
  archivedClients: number;
  /** `convertedClients / totalLeads * 100`, rounded to 1 decimal; `0` when `totalLeads` is `0`. */
  conversionRate: number;
  leadsBySource: { sourceId: string; sourceName: string; count: number }[];
  /** Open, lead-linked follow-up `Task`s due within the next 30 days. */
  upcomingFollowUps: number;
}
