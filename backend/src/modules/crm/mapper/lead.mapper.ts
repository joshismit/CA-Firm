import { Lead, LeadStage, LeadNote, LeadAssignment } from '@prisma/client';
import {
  LeadResponseDto,
  LeadStageResponseDto,
  LeadNoteResponseDto,
  LeadAssignmentResponseDto,
} from '../dto/lead.res.dto';

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
      priority: lead.priority,
      expectedRevenue: lead.expectedRevenue ? lead.expectedRevenue.toNumber() : null,
      probability: lead.probability,
      expectedCloseDate: lead.expectedCloseDate ? lead.expectedCloseDate.toISOString() : null,
      interestedServices: lead.interestedServices,
      proposalSentAt: lead.proposalSentAt ? lead.proposalSentAt.toISOString() : null,
      proposalAcceptedAt: lead.proposalAcceptedAt ? lead.proposalAcceptedAt.toISOString() : null,
      proposalRejectedAt: lead.proposalRejectedAt ? lead.proposalRejectedAt.toISOString() : null,
      proposalValue: lead.proposalValue ? lead.proposalValue.toNumber() : null,
      proposalRemarks: lead.proposalRemarks,
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

  static toNoteResponseDto(note: LeadNote): LeadNoteResponseDto {
    return {
      id: note.id,
      leadId: note.leadId,
      authorId: note.authorId,
      content: note.content,
      documentId: note.documentId,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  static toNoteResponseDtoList(notes: LeadNote[]): LeadNoteResponseDto[] {
    return notes.map((note) => this.toNoteResponseDto(note));
  }

  static toAssignmentResponseDto(assignment: LeadAssignment): LeadAssignmentResponseDto {
    return {
      id: assignment.id,
      leadId: assignment.leadId,
      userId: assignment.userId,
      isPrimary: assignment.isPrimary,
      assignedAt: assignment.assignedAt.toISOString(),
    };
  }

  static toAssignmentResponseDtoList(assignments: LeadAssignment[]): LeadAssignmentResponseDto[] {
    return assignments.map((assignment) => this.toAssignmentResponseDto(assignment));
  }
}
