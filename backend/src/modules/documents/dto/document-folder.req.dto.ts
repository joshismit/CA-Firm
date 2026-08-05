import { z } from 'zod';
import { createFolderSchema, updateFolderSchema, listFoldersQuerySchema } from '../schemas/document-folder.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/document-folder.schema.ts`.
 * These are the shapes the controller/service receive AFTER `validate()` has run.
 */

export type CreateFolderDto = z.infer<typeof createFolderSchema>;
export type UpdateFolderDto = z.infer<typeof updateFolderSchema>;
export type ListFoldersQueryDto = z.infer<typeof listFoldersQuerySchema>;
