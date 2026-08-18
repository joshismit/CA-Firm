import { Contact, ContactRole } from '@prisma/client';
import { ContactResponseDto, ContactRoleResponseDto } from '../dto/contact.res.dto';

/**
 * Entity ⇄ DTO mapper for `Contact`/`ContactRole`. Controllers/services must
 * always return data through this mapper — never serialize a raw Prisma row
 * in a response.
 */
export class ContactMapper {
  static toResponseDto(contact: Contact): ContactResponseDto {
    return {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      pan: contact.pan,
      portalUserId: contact.portalUserId,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(contacts: Contact[]): ContactResponseDto[] {
    return contacts.map((contact) => this.toResponseDto(contact));
  }

  static toRoleResponseDto(role: ContactRole): ContactRoleResponseDto {
    return {
      id: role.id,
      businessId: role.businessId,
      contactId: role.contactId,
      roleType: role.roleType,
      customTitle: role.customTitle,
      isPrimary: role.isPrimary,
      sharePercent: role.sharePercent ? role.sharePercent.toNumber() : null,
    };
  }

  static toRoleResponseDtoList(roles: ContactRole[]): ContactRoleResponseDto[] {
    return roles.map((role) => this.toRoleResponseDto(role));
  }
}
