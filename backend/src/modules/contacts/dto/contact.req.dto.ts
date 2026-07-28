import { z } from 'zod';
import {
  createContactSchema,
  updateContactSchema,
  listContactsQuerySchema,
  assignContactRoleSchema,
} from '../schemas/contact.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/contact.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CreateContactDto = z.infer<typeof createContactSchema>;
export type UpdateContactDto = z.infer<typeof updateContactSchema>;
export type ListContactsQueryDto = z.infer<typeof listContactsQuerySchema>;
export type AssignContactRoleDto = z.infer<typeof assignContactRoleSchema>;
