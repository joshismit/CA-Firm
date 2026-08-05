import { DocumentCategory } from '@prisma/client';
import {
  businessIdParamSchema,
  folderIdParamSchema,
  createFolderSchema,
  updateFolderSchema,
  listFoldersQuerySchema,
} from '@modules/documents/schemas/document-folder.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Folder Zod Schemas — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirrors `document.schema.spec.ts` — pure `.safeParse()` input → success/
 * failure assertions, independent of Express/`validate()`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222';

describe('businessIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(businessIdParamSchema.safeParse({ businessId: VALID_UUID_1 }).success).toBe(true);
  });

  it('rejects a non-UUID businessId', () => {
    expect(businessIdParamSchema.safeParse({ businessId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('folderIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(folderIdParamSchema.safeParse({ id: VALID_UUID_1 }).success).toBe(true);
  });

  it('rejects a missing id', () => {
    expect(folderIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('createFolderSchema', () => {
  it('accepts the minimal valid payload (category + name)', () => {
    const result = createFolderSchema.safeParse({ category: DocumentCategory.PAN, name: 'Registration Docs' });
    expect(result.success).toBe(true);
  });

  it('accepts a fully-populated payload with parentFolderId', () => {
    const result = createFolderSchema.safeParse({
      category: DocumentCategory.GST,
      parentFolderId: VALID_UUID_1,
      name: 'FY 2025-26',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing category', () => {
    const result = createFolderSchema.safeParse({ name: 'No Category' });
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing name', () => {
    const result = createFolderSchema.safeParse({ category: DocumentCategory.PAN });
    expect(result.success).toBe(false);
  });

  it('rejects an empty (whitespace-only) name', () => {
    const result = createFolderSchema.safeParse({ category: DocumentCategory.PAN, name: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects a name over 255 characters', () => {
    const result = createFolderSchema.safeParse({ category: DocumentCategory.PAN, name: 'a'.repeat(256) });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid category', () => {
    const result = createFolderSchema.safeParse({ category: 'NOT_A_CATEGORY', name: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid parentFolderId', () => {
    const result = createFolderSchema.safeParse({ category: DocumentCategory.PAN, name: 'x', parentFolderId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('updateFolderSchema', () => {
  it('accepts a valid rename payload', () => {
    expect(updateFolderSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });

  it('rejects a missing name (rename is the only supported update)', () => {
    expect(updateFolderSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(updateFolderSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('does not accept businessId/category/parentFolderId (immutable after creation)', () => {
    const result = updateFolderSchema.safeParse({ name: 'x', category: DocumentCategory.GST });
    // Extra keys are stripped by default ZodObject parsing, not rejected — assert they don't survive.
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('category');
    }
  });
});

describe('listFoldersQuerySchema', () => {
  it('accepts an empty query (no filters)', () => {
    expect(listFoldersQuerySchema.safeParse({}).success).toBe(true);
  });

  it('accepts category and parentFolderId filters', () => {
    const result = listFoldersQuerySchema.safeParse({ category: DocumentCategory.ROC, parentFolderId: VALID_UUID_2 });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid category', () => {
    expect(listFoldersQuerySchema.safeParse({ category: 'NOT_A_CATEGORY' }).success).toBe(false);
  });

  it('rejects an invalid parentFolderId', () => {
    expect(listFoldersQuerySchema.safeParse({ parentFolderId: 'not-a-uuid' }).success).toBe(false);
  });
});
