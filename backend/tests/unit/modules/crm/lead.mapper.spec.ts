import { Lead, LeadStage, Prisma } from '@prisma/client';
import { LeadMapper } from '@modules/crm/mapper/lead.mapper';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LeadMapper — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Pure function tests — no mocking needed, `LeadMapper` has no side effects
 * or dependencies beyond the Prisma-generated types it converts. Covers the
 * Prisma row → response DTO direction only; there is no DTO → Prisma
 * direction for this mapper (that conversion is `CreateLeadDto`/`UpdateLeadDto`
 * passed straight through by `LeadService`, exactly like
 * `BusinessService`/`ContactService` — the mapper only ever serialises
 * outbound responses).
 * ─────────────────────────────────────────────────────────────────────────────
 */

function buildLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    tenantId: 'tenant-1',
    businessId: 'business-1',
    contactId: 'contact-1',
    title: 'Acme Corp — GST Advisory',
    sourceId: 'source-1',
    stageId: 'stage-1',
    expectedRevenue: new Prisma.Decimal(125000.5),
    probability: 60,
    expectedCloseDate: new Date('2026-03-15'),
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-02T11:30:00.000Z'),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

describe('LeadMapper', () => {
  describe('toResponseDto', () => {
    it('maps every field, converting Decimal → number and Date → ISO string', () => {
      const lead = buildLead();

      const dto = LeadMapper.toResponseDto(lead);

      expect(dto).toEqual({
        id: 'lead-1',
        businessId: 'business-1',
        contactId: 'contact-1',
        title: 'Acme Corp — GST Advisory',
        sourceId: 'source-1',
        stageId: 'stage-1',
        expectedRevenue: 125000.5,
        probability: 60,
        expectedCloseDate: new Date('2026-03-15').toISOString(),
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-02T11:30:00.000Z',
      });
    });

    it('never leaks internal-only fields (tenantId, deletedAt, deletedBy)', () => {
      const lead = buildLead();

      const dto = LeadMapper.toResponseDto(lead);

      expect(dto).not.toHaveProperty('tenantId');
      expect(dto).not.toHaveProperty('deletedAt');
      expect(dto).not.toHaveProperty('deletedBy');
    });

    it('maps null businessId/contactId/expectedRevenue/probability/expectedCloseDate through as null, not undefined or 0', () => {
      const lead = buildLead({
        businessId: null,
        contactId: null,
        expectedRevenue: null,
        probability: null,
        expectedCloseDate: null,
      });

      const dto = LeadMapper.toResponseDto(lead);

      expect(dto.businessId).toBeNull();
      expect(dto.contactId).toBeNull();
      expect(dto.expectedRevenue).toBeNull();
      expect(dto.probability).toBeNull();
      expect(dto.expectedCloseDate).toBeNull();
    });

    it('preserves probability 0 as a real zero (not coerced to null via falsy checks)', () => {
      const lead = buildLead({ probability: 0 });

      const dto = LeadMapper.toResponseDto(lead);

      expect(dto.probability).toBe(0);
    });
  });

  describe('toResponseDtoList', () => {
    it('maps every lead in the array, preserving order', () => {
      const leads = [buildLead({ id: 'lead-1' }), buildLead({ id: 'lead-2' }), buildLead({ id: 'lead-3' })];

      const dtos = LeadMapper.toResponseDtoList(leads);

      expect(dtos.map((d) => d.id)).toEqual(['lead-1', 'lead-2', 'lead-3']);
    });

    it('returns an empty array for an empty input', () => {
      expect(LeadMapper.toResponseDtoList([])).toEqual([]);
    });
  });

  describe('toStageResponseDto', () => {
    it('maps id/name/order as-is', () => {
      const stage: LeadStage = { id: 'stage-1', tenantId: 'tenant-1', name: 'Proposal', order: 2 };

      const dto = LeadMapper.toStageResponseDto(stage);

      expect(dto).toEqual({ id: 'stage-1', name: 'Proposal', order: 2 });
    });

    it('never leaks tenantId', () => {
      const stage: LeadStage = { id: 'stage-1', tenantId: 'tenant-1', name: 'Proposal', order: 2 };

      const dto = LeadMapper.toStageResponseDto(stage);

      expect(dto).not.toHaveProperty('tenantId');
    });
  });

  describe('toStageResponseDtoList', () => {
    it('maps every stage in the array, preserving order', () => {
      const stages: LeadStage[] = [
        { id: 'stage-1', tenantId: 'tenant-1', name: 'New', order: 1 },
        { id: 'stage-2', tenantId: 'tenant-1', name: 'Proposal', order: 2 },
      ];

      const dtos = LeadMapper.toStageResponseDtoList(stages);

      expect(dtos).toEqual([
        { id: 'stage-1', name: 'New', order: 1 },
        { id: 'stage-2', name: 'Proposal', order: 2 },
      ]);
    });
  });
});
