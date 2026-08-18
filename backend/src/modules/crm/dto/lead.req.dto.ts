import { z } from 'zod';
import {
  createLeadSchema,
  updateLeadSchema,
  listLeadsQuerySchema,
  convertLeadSchema,
  createLeadNoteSchema,
  assignLeadSchema,
  sendProposalSchema,
  respondProposalSchema,
  leadTimelineQuerySchema,
} from '../schemas/lead.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/lead.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CreateLeadDto = z.infer<typeof createLeadSchema>;
export type UpdateLeadDto = z.infer<typeof updateLeadSchema>;
export type ListLeadsQueryDto = z.infer<typeof listLeadsQuerySchema>;
export type ConvertLeadDto = z.infer<typeof convertLeadSchema>;
export type CreateLeadNoteDto = z.infer<typeof createLeadNoteSchema>;
export type AssignLeadDto = z.infer<typeof assignLeadSchema>;
export type SendProposalDto = z.infer<typeof sendProposalSchema>;
export type RespondProposalDto = z.infer<typeof respondProposalSchema>;
export type LeadTimelineQueryDto = z.infer<typeof leadTimelineQuerySchema>;
