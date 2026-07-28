import { Request } from 'express';
import { Contact, ContactRole } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError } from '@shared/errors';
import { PaginationMeta } from '@shared/types';
import { ContactRepository } from '../repository/contact.repository';
import { ContactRoleRepository } from '../repository/contact-role.repository';
import { CreateContactDto, UpdateContactDto, ListContactsQueryDto, AssignContactRoleDto } from '../dto/contact.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Contact Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for `Contact` and its `ContactRole` (business assignment)
 * relation. No HTTP concerns — callers (controllers) pass plain values in and
 * get domain entities back. Mirrors `modules/business/service/business.service.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ContactService extends BaseService {
  constructor(
    req: Request,
    private readonly contactRepository: ContactRepository = new ContactRepository(prisma),
    private readonly contactRoleRepository: ContactRoleRepository = new ContactRoleRepository(prisma),
  ) {
    super(req);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Create / Update / Delete
  // ────────────────────────────────────────────────────────────────────────────

  async createContact(dto: CreateContactDto): Promise<Contact> {
    this.logger.info({ firstName: dto.firstName }, 'Creating contact');

    return this.contactRepository.create(
      {
        firstName: dto.firstName,
        lastName: dto.lastName ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        pan: dto.pan ?? null,
      },
      { tenantId: this.tenantId },
    );
  }

  async updateContact(id: string, dto: UpdateContactDto): Promise<Contact> {
    const existing = await this.contactRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Contact');

    this.logger.info({ contactId: id }, 'Updating contact');

    return this.contactRepository.update(id, dto, { tenantId: this.tenantId });
  }

  async deleteContact(id: string): Promise<void> {
    const existing = await this.contactRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Contact');

    this.logger.info({ contactId: id }, 'Deleting contact');

    await this.contactRepository.delete(id, { tenantId: this.tenantId });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────────

  async getContactById(id: string): Promise<Contact> {
    const contact = await this.contactRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(contact, 'Contact');
    return contact;
  }

  async listContacts(query: ListContactsQueryDto): Promise<{ data: Contact[]; meta: PaginationMeta }> {
    return this.contactRepository.search(
      { businessId: query.businessId, search: query.search },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      { tenantId: this.tenantId },
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Contact Roles (Business assignment)
  // ────────────────────────────────────────────────────────────────────────────

  async listContactRoles(contactId: string): Promise<ContactRole[]> {
    const contact = await this.contactRepository.findById(contactId, { tenantId: this.tenantId });
    this.validateExists(contact, 'Contact');

    return this.contactRoleRepository.findByContact(contactId, { tenantId: this.tenantId });
  }

  async assignContactRole(dto: AssignContactRoleDto): Promise<ContactRole> {
    const contact = await this.contactRepository.findById(dto.contactId, { tenantId: this.tenantId });
    this.validateExists(contact, 'Contact');

    const existing = await this.contactRoleRepository.findExisting(
      dto.businessId,
      dto.contactId,
      dto.roleType,
      { tenantId: this.tenantId },
    );
    if (existing) {
      throw new ConflictError(`This contact already has the ${dto.roleType} role for this business.`);
    }

    this.logger.info(
      { contactId: dto.contactId, businessId: dto.businessId, roleType: dto.roleType },
      'Assigning contact role',
    );

    // An invalid businessId surfaces as a 409 (P2003 foreign key violation),
    // handled centrally by errorMiddleware — no pre-check needed for it.
    // Clearing the previous primary and creating the new role must commit
    // atomically, so a business is never briefly left with two (or zero)
    // primary contacts if this fails partway through.
    return this.transaction(async (tx) => {
      if (dto.isPrimary) {
        await this.contactRoleRepository.clearPrimaryForBusiness(dto.businessId, { tenantId: this.tenantId, tx });
      }

      return this.contactRoleRepository.create(
        {
          businessId: dto.businessId,
          contactId: dto.contactId,
          roleType: dto.roleType,
          customTitle: dto.customTitle ?? null,
          isPrimary: dto.isPrimary ?? false,
          sharePercent: dto.sharePercent ?? null,
        },
        { tenantId: this.tenantId, tx },
      );
    });
  }
}
