// documents module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting), the service (so other modules can compose with it in-process),
// permission constants, and DTO types. `DocumentRepository`,
// `DocumentController`, and `DocumentMapper` are deliberately NOT exported —
// they're internal implementation details; other modules should go through
// `DocumentService`, never around it. Mirrors `modules/crm/index.ts`.

export { default as documentRoutes } from './routes/document.routes';
export { DocumentService } from './service/document.service';
export { DOCUMENT_PERMISSIONS } from './constants/document.permissions';
export type { DocumentResponseDto, DocumentDownloadUrlResponseDto } from './dto/document.res.dto';
export type { CreateDocumentDto, UpdateDocumentDto, ListDocumentsQueryDto } from './dto/document.req.dto';
