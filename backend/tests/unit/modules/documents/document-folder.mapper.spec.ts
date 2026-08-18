import { DocumentCategory, DocumentFolder } from '@prisma/client';
import { DocumentFolderMapper } from '@modules/documents/mapper/document-folder.mapper';

function buildFolder(overrides: Partial<DocumentFolder> = {}): DocumentFolder {
  return {
    id: 'folder-1',
    tenantId: 'tenant-1',
    businessId: 'business-1',
    category: DocumentCategory.PAN,
    parentFolderId: null,
    name: 'Registration Docs',
    createdById: 'user-1',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-02T11:30:00.000Z'),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

describe('DocumentFolderMapper', () => {
  describe('toResponseDto', () => {
    it('maps every field, converting Date → ISO string', () => {
      const dto = DocumentFolderMapper.toResponseDto(buildFolder());

      expect(dto).toEqual({
        id: 'folder-1',
        businessId: 'business-1',
        category: DocumentCategory.PAN,
        parentFolderId: null,
        name: 'Registration Docs',
        createdById: 'user-1',
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-02T11:30:00.000Z',
      });
    });

    it('never leaks internal-only fields (tenantId, deletedAt, deletedBy)', () => {
      const dto = DocumentFolderMapper.toResponseDto(buildFolder());

      expect(dto).not.toHaveProperty('tenantId');
      expect(dto).not.toHaveProperty('deletedAt');
      expect(dto).not.toHaveProperty('deletedBy');
    });

    it('maps a non-null parentFolderId through as-is', () => {
      const dto = DocumentFolderMapper.toResponseDto(buildFolder({ parentFolderId: 'parent-1' }));
      expect(dto.parentFolderId).toBe('parent-1');
    });
  });

  describe('toResponseDtoList', () => {
    it('maps every folder in the array, preserving order', () => {
      const folders = [buildFolder({ id: 'folder-1' }), buildFolder({ id: 'folder-2' })];
      const dtos = DocumentFolderMapper.toResponseDtoList(folders);
      expect(dtos.map((f) => f.id)).toEqual(['folder-1', 'folder-2']);
    });

    it('returns an empty array for an empty input', () => {
      expect(DocumentFolderMapper.toResponseDtoList([])).toEqual([]);
    });
  });
});
