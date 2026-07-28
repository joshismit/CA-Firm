import { Lead, LeadStage } from '@prisma/client';
import { LeadResponseDto, LeadStageResponseDto } from '../dto/lead.res.dto';

/**
 * Entity ⇄ DTO mapper for `Lead`/`LeadStage`. Controllers/services must
 * always return data through this mapper — never serialize a raw Prisma row
 * in a response.
 */
export class LeadMapper {
  static toResponseDto(lead: Lead): LeadResponseDto {
    return {
      id: lead.id,
      businessId: lead.businessId,
      contactId: lead.contactId,
      title: lead.title,
      sourceId: lead.sourceId,
      stageId: lead.stageId,
      expectedRevenue: lead.expectedRevenue ? lead.expectedRevenue.toNumber() : null,
      probability: lead.probability,
      expectedCloseDate: lead.expectedCloseDate ? lead.expectedCloseDate.toISOString() : null,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(leads: Lead[]): LeadResponseDto[] {
    return leads.map((lead) => this.toResponseDto(lead));
  }

  static toStageResponseDto(stage: LeadStage): LeadStageResponseDto {
    return { id: stage.id, name: stage.name, order: stage.order };
  }

  static toStageResponseDtoList(stages: LeadStage[]): LeadStageResponseDto[] {
    return stages.map((stage) => this.toStageResponseDto(stage));
  }
}
