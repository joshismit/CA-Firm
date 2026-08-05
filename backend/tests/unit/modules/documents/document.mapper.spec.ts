import { Document, DocumentCategory } from '@prisma/client';
import { DocumentMapper } from '@modules/documents/mapper/document.mapper';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DocumentMapper — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Pure function tests — no mocking needed. Covers the Prisma row → response
 * DTO direction only; there is no DTO → Prisma direction for this mapper
 * (see the mapper's header comment). Mirrors
 * `tests/unit/modules/crm/lead.mapper.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function buildDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    tenantId: 'tenant-1',
    businessId: 'business-1',
    contactId: 'contact-1',
    folderId: null,
    category: DocumentCategory.PAN,
    fileName: 'pan-card.pdf',
    storageKey: 'tenant-1/abc123-pan-card.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 204800,
    version: 1,
    isLatestVersion: true,
    rootDocumentId: null,
    previousVersionId: null,
    uploadedById: 'user-1',
    archived: false,
    retentionUntil: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-02T11:30:00.000Z'),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

describe('DocumentMapper', () => {
  describe('toResponseDto', () => {
    it('maps every field, converting Date → ISO string', () => {
      const document = buildDocument();

      const dto = DocumentMapper.toResponseDto(document);

      expect(dto).toEqual({
        id: 'doc-1',
        businessId: 'business-1',
        contactId: 'contact-1',
        folderId: null,
        category: DocumentCategory.PAN,
        fileName: 'pan-card.pdf',
        storageKey: 'tenant-1/abc123-pan-card.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 204800,
        version: 1,
        isLatestVersion: true,
        rootDocumentId: null,
        previousVersionId: null,
        uploadedById: 'user-1',
        createdAt: '2026-01-01T10:00:00.000Z',
      });
    });

    it('never leaks internal-only fields (tenantId, updatedAt, deletedAt, deletedBy)', () => {
      const document = buildDocument();

      const dto = DocumentMapper.toResponseDto(document);

      expect(dto).not.toHaveProperty('tenantId');
      expect(dto).not.toHaveProperty('updatedAt');
      expect(dto).not.toHaveProperty('deletedAt');
      expect(dto).not.toHaveProperty('deletedBy');
    });

    it('maps null businessId/contactId through as null, not undefined', () => {
      const document = buildDocument({ businessId: null, contactId: null });

      const dto = DocumentMapper.toResponseDto(document);

      expect(dto.businessId).toBeNull();
      expect(dto.contactId).toBeNull();
    });

    it('preserves version as a real number (not coerced by falsy checks)', () => {
      const document = buildDocument({ version: 2 });

      const dto = DocumentMapper.toResponseDto(document);

      expect(dto.version).toBe(2);
    });

    it('maps the version-chain fields (PRD §7.2) through as-is', () => {
      const document = buildDocument({
        version: 2,
        isLatestVersion: false,
        rootDocumentId: 'doc-1',
        previousVersionId: 'doc-1',
      });

      const dto = DocumentMapper.toResponseDto(document);

      expect(dto.isLatestVersion).toBe(false);
      expect(dto.rootDocumentId).toBe('doc-1');
      expect(dto.previousVersionId).toBe('doc-1');
    });
  });

  describe('toResponseDtoList', () => {
    it('maps every document in the array, preserving order', () => {
      const documents = [buildDocument({ id: 'doc-1' }), buildDocument({ id: 'doc-2' }), buildDocument({ id: 'doc-3' })];

      const dtos = DocumentMapper.toResponseDtoList(documents);

      expect(dtos.map((d) => d.id)).toEqual(['doc-1', 'doc-2', 'doc-3']);
    });

    it('returns an empty array for an empty input', () => {
      expect(DocumentMapper.toResponseDtoList([])).toEqual([]);
    });
  });
});
