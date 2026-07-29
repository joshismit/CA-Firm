import { Document } from '@prisma/client';
import { DocumentResponseDto } from '../dto/document.res.dto';

/**
 * Entity ⇄ DTO mapper for `Document`. Controllers/services must always
 * return data through this mapper — never serialize a raw Prisma row in a
 * response. Mirrors `modules/crm/mapper/lead.mapper.ts` — no DTO → Prisma
 * direction exists here either; `CreateDocumentDto`/`UpdateDocumentDto` are
 * passed straight through by `DocumentService`.
 */
export class DocumentMapper {
  static toResponseDto(document: Document): DocumentResponseDto {
    return {
      id: document.id,
      businessId: document.businessId,
      contactId: document.contactId,
      category: document.category,
      fileName: document.fileName,
      storageKey: document.storageKey,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      version: document.version,
      uploadedById: document.uploadedById,
      createdAt: document.createdAt.toISOString(),
    };
  }

  static toResponseDtoList(documents: Document[]): DocumentResponseDto[] {
    return documents.map((document) => this.toResponseDto(document));
  }
}
