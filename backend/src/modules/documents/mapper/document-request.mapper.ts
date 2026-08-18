import { DocumentRequest } from '@prisma/client';
import { DocumentRequestResponseDto } from '../dto/document-request.res.dto';

/** Entity ⇄ DTO mapper for `DocumentRequest`. Services/controllers must always return data through this mapper — never serialize a raw Prisma row. */
export class DocumentRequestMapper {
  static toResponseDto(request: DocumentRequest): DocumentRequestResponseDto {
    return {
      id: request.id,
      businessId: request.businessId,
      category: request.category,
      description: request.description,
      dueDate: request.dueDate?.toISOString() ?? null,
      status: request.status,
      requestedById: request.requestedById,
      fulfilledDocumentId: request.fulfilledDocumentId,
      fulfilledAt: request.fulfilledAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(requests: DocumentRequest[]): DocumentRequestResponseDto[] {
    return requests.map((request) => this.toResponseDto(request));
  }
}
