import { DocumentFolder } from '@prisma/client';
import { DocumentFolderResponseDto } from '../dto/document-folder.res.dto';

/**
 * Entity ⇄ DTO mapper for `DocumentFolder`. Controllers/services must always
 * return data through this mapper — never serialize a raw Prisma row in a
 * response. Mirrors `document.mapper.ts`.
 */
export class DocumentFolderMapper {
  static toResponseDto(folder: DocumentFolder): DocumentFolderResponseDto {
    return {
      id: folder.id,
      businessId: folder.businessId,
      category: folder.category,
      parentFolderId: folder.parentFolderId,
      name: folder.name,
      createdById: folder.createdById,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(folders: DocumentFolder[]): DocumentFolderResponseDto[] {
    return folders.map((folder) => this.toResponseDto(folder));
  }
}
