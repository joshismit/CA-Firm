import { NotificationTemplate } from '@prisma/client';
import { NotificationTemplateResponseDto } from '../dto/notification-template.res.dto';

/**
 * Entity ⇄ DTO mapper for `NotificationTemplate`. Services/controllers must
 * always return data through this mapper — never serialize a raw Prisma row.
 */
export class NotificationTemplateMapper {
  static toResponseDto(template: NotificationTemplate, isOverridden = false): NotificationTemplateResponseDto {
    return {
      id: template.id,
      key: template.key,
      channel: template.channel,
      name: template.name,
      description: template.description,
      subjectTemplate: template.subjectTemplate,
      bodyTemplateText: template.bodyTemplateText,
      bodyTemplateHtml: template.bodyTemplateHtml,
      isActive: template.isActive,
      isSystemDefault: template.isSystemDefault,
      isOverridden,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(templates: NotificationTemplate[]): NotificationTemplateResponseDto[] {
    return templates.map((template) => this.toResponseDto(template));
  }
}
