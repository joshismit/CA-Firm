import { DocumentCategory } from '@prisma/client';
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentIdParamSchema,
  listDocumentsQuerySchema,
} from '@modules/documents/schemas/document.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Zod Schemas — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the schemas directly (`.safeParse()`), independent of Express/
 * `validate()` middleware — pure input → success/failure assertions. Mirrors
 * `tests/unit/modules/crm/lead.schema.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222';

describe('createDocumentSchema', () => {
  it('accepts the minimal valid payload (category only)', () => {
    const result = createDocumentSchema.safeParse({ category: DocumentCategory.PAN });
    expect(result.success).toBe(true);
  });

  it('accepts a fully-populated valid payload', () => {
    const result = createDocumentSchema.safeParse({
      businessId: VALID_UUID_1,
      contactId: VALID_UUID_2,
      category: DocumentCategory.GST,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing the required category field', () => {
    const result = createDocumentSchema.safeParse({ businessId: VALID_UUID_1 });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid category value', () => {
    const result = createDocumentSchema.safeParse({ category: 'NOT_A_CATEGORY' });
    expect(result.success).toBe(false);
  });

  it.each(['businessId', 'contactId'])('rejects an invalid UUID for %s', (field) => {
    const result = createDocumentSchema.safeParse({
      category: DocumentCategory.PAN,
      [field]: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateDocumentSchema', () => {
  it('accepts an empty object (every field optional)', () => {
    const result = updateDocumentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it.each(['businessId', 'contactId'])('accepts explicit null for nullable field %s (clears it)', (field) => {
    const result = updateDocumentSchema.safeParse({ [field]: null });
    expect(result.success).toBe(true);
  });

  it('rejects explicit null for category (not nullable, only optional)', () => {
    const result = updateDocumentSchema.safeParse({ category: null });
    expect(result.success).toBe(false);
  });

  it('accepts a valid partial update', () => {
    const result = updateDocumentSchema.safeParse({ category: DocumentCategory.AUDIT });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid businessId when provided', () => {
    const result = updateDocumentSchema.safeParse({ businessId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid category when provided', () => {
    const result = updateDocumentSchema.safeParse({ category: 'NOT_A_CATEGORY' });
    expect(result.success).toBe(false);
  });
});

describe('documentIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(documentIdParamSchema.safeParse({ id: VALID_UUID_1 }).success).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    expect(documentIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects a missing id', () => {
    expect(documentIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('listDocumentsQuerySchema', () => {
  it('applies pagination defaults when nothing is provided', () => {
    const result = listDocumentsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
    }
  });

  it('accepts category/businessId filters', () => {
    const result = listDocumentsQuerySchema.safeParse({ category: DocumentCategory.ROC, businessId: VALID_UUID_1 });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid category', () => {
    const result = listDocumentsQuerySchema.safeParse({ category: 'NOT_A_CATEGORY' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid businessId', () => {
    const result = listDocumentsQuerySchema.safeParse({ businessId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a page below 1', () => {
    const result = listDocumentsQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a limit above 100', () => {
    const result = listDocumentsQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });
});
