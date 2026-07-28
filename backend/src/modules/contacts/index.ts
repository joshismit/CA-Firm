// contacts module — public exports
//
// Only the module's actual public surface is exported here: the router (for
// mounting), the service (so other modules can compose with it in-process),
// permission constants, and DTO types. `ContactRepository`,
// `ContactRoleRepository`, `ContactController`, and `ContactMapper` are
// deliberately NOT exported — they're internal implementation details; other
// modules should go through `ContactService`, never around it. Mirrors
// `modules/business/index.ts`.

export { default as contactRoutes } from './routes/contact.routes';
export { ContactService } from './service/contact.service';
export { CONTACT_PERMISSIONS } from './constants/contact.permissions';
export type { ContactResponseDto, ContactRoleResponseDto } from './dto/contact.res.dto';
export type {
  CreateContactDto,
  UpdateContactDto,
  ListContactsQueryDto,
  AssignContactRoleDto,
} from './dto/contact.req.dto';
