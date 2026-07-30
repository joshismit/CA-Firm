import { ComplianceFiling } from '@prisma/client';
import { ComplianceFilingResponseDto } from '../dto/compliance-filing.res.dto';

/**
 * Entity ⇄ DTO mapper for `ComplianceFiling`. Controllers/services must
 * always return data through this mapper — never serialize a raw Prisma row
 * in a response.
 */
export class ComplianceFilingMapper {
  static toResponseDto(filing: ComplianceFiling): ComplianceFilingResponseDto {
    return {
      id: filing.id,
      reference: filing.reference,
      period: filing.period,
      status: filing.status,
      dueDate: filing.dueDate ? filing.dueDate.toISOString() : null,
      filedDate: filing.filedDate ? filing.filedDate.toISOString() : null,
      notes: filing.notes,
      createdAt: filing.createdAt.toISOString(),
      updatedAt: filing.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(filings: ComplianceFiling[]): ComplianceFilingResponseDto[] {
    return filings.map((filing) => this.toResponseDto(filing));
  }
}
