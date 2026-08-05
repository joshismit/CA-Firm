// documents module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting), the service (so other modules can compose with it in-process),
// permission constants, and DTO types. `DocumentRepository`,
// `DocumentController`, and `DocumentMapper` are deliberately NOT exported —
// they're internal implementation details; other modules should go through
// `DocumentService`, never around it. Mirrors `modules/crm/index.ts`.
//
// `StorageQuotaService` (PRD §7.4) is exported too — `BusinessService` reuses
// it for the storage-usage summary on `GET /business/:id` rather than
// duplicating "what's this business's quota and usage" a second time. Same
// cross-module service-import precedent as `modules/master-admin` importing
// `NotificationDispatchService`/`UserRepository` directly.

export { default as documentRoutes } from './routes/document.routes';
export { default as documentFolderRoutes } from './routes/document-folder.routes';
export { DocumentService } from './service/document.service';
export { DocumentFolderService } from './service/document-folder.service';
export { StorageQuotaService } from './service/storage-quota.service';
export type { StorageSummary } from './service/storage-quota.service';
export { DOCUMENT_PERMISSIONS } from './constants/document.permissions';
export type { DocumentResponseDto, DocumentDownloadUrlResponseDto, DocumentConflictDto } from './dto/document.res.dto';
export type { CreateDocumentDto, UpdateDocumentDto, ListDocumentsQueryDto } from './dto/document.req.dto';
export type { DocumentFolderResponseDto } from './dto/document-folder.res.dto';
export type { CreateFolderDto, UpdateFolderDto, ListFoldersQueryDto } from './dto/document-folder.req.dto';
