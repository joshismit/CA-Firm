import {
  createLeadSchema,
  updateLeadSchema,
  leadIdParamSchema,
  listLeadsQuerySchema,
  convertLeadSchema,
} from '@modules/crm/schemas/lead.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Lead Zod Schemas — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the schemas directly (`.safeParse()`), independent of Express/
 * `validate()` middleware — pure input → success/failure assertions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222';
const VALID_UUID_3 = '33333333-3333-4333-8333-333333333333';
const VALID_UUID_4 = '44444444-4444-4444-8444-444444444444';

describe('createLeadSchema', () => {
  it('accepts the minimal valid payload (title + sourceId + stageId only)', () => {
    const result = createLeadSchema.safeParse({
      title: 'Acme Corp — GST Advisory',
      sourceId: VALID_UUID_1,
      stageId: VALID_UUID_2,
    });

    expect(result.success).toBe(true);
  });

  it('accepts a fully-populated valid payload', () => {
    const result = createLeadSchema.safeParse({
      businessId: VALID_UUID_1,
      contactId: VALID_UUID_2,
      title: 'Acme Corp — GST Advisory',
      sourceId: VALID_UUID_3,
      stageId: VALID_UUID_4,
      expectedRevenue: 50000,
      probability: 70,
      expectedCloseDate: '2026-03-01',
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ['title', { sourceId: VALID_UUID_1, stageId: VALID_UUID_2 }],
    ['sourceId', { title: 'Valid Title', stageId: VALID_UUID_2 }],
    ['stageId', { title: 'Valid Title', sourceId: VALID_UUID_1 }],
  ])('rejects a payload missing required field %s', (_field, payload) => {
    const result = createLeadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a title shorter than 2 characters', () => {
    const result = createLeadSchema.safeParse({ title: 'A', sourceId: VALID_UUID_1, stageId: VALID_UUID_2 });
    expect(result.success).toBe(false);
  });

  it('rejects a title longer than 255 characters', () => {
    const result = createLeadSchema.safeParse({
      title: 'A'.repeat(256),
      sourceId: VALID_UUID_1,
      stageId: VALID_UUID_2,
    });
    expect(result.success).toBe(false);
  });

  it.each(['businessId', 'contactId', 'sourceId', 'stageId'])('rejects an invalid UUID for %s', (field) => {
    const result = createLeadSchema.safeParse({
      title: 'Valid Title',
      sourceId: VALID_UUID_1,
      stageId: VALID_UUID_2,
      [field]: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative expectedRevenue', () => {
    const result = createLeadSchema.safeParse({
      title: 'Valid Title',
      sourceId: VALID_UUID_1,
      stageId: VALID_UUID_2,
      expectedRevenue: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts expectedRevenue of exactly 0', () => {
    const result = createLeadSchema.safeParse({
      title: 'Valid Title',
      sourceId: VALID_UUID_1,
      stageId: VALID_UUID_2,
      expectedRevenue: 0,
    });
    expect(result.success).toBe(true);
  });

  it.each([-1, 101])('rejects probability out of the 0-100 range (%d)', (probability) => {
    const result = createLeadSchema.safeParse({
      title: 'Valid Title',
      sourceId: VALID_UUID_1,
      stageId: VALID_UUID_2,
      probability,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer probability', () => {
    const result = createLeadSchema.safeParse({
      title: 'Valid Title',
      sourceId: VALID_UUID_1,
      stageId: VALID_UUID_2,
      probability: 50.5,
    });
    expect(result.success).toBe(false);
  });

  it.each([0, 100])('accepts probability at the boundary (%d)', (probability) => {
    const result = createLeadSchema.safeParse({
      title: 'Valid Title',
      sourceId: VALID_UUID_1,
      stageId: VALID_UUID_2,
      probability,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unparseable expectedCloseDate', () => {
    const result = createLeadSchema.safeParse({
      title: 'Valid Title',
      sourceId: VALID_UUID_1,
      stageId: VALID_UUID_2,
      expectedCloseDate: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('coerces a valid ISO date string for expectedCloseDate into a Date', () => {
    const result = createLeadSchema.safeParse({
      title: 'Valid Title',
      sourceId: VALID_UUID_1,
      stageId: VALID_UUID_2,
      expectedCloseDate: '2026-03-01',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expectedCloseDate).toBeInstanceOf(Date);
    }
  });
});

describe('updateLeadSchema', () => {
  it('accepts an empty object (every field optional)', () => {
    const result = updateLeadSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it.each(['businessId', 'contactId', 'expectedRevenue', 'probability', 'expectedCloseDate'])(
    'accepts explicit null for nullable field %s (clears it)',
    (field) => {
      const result = updateLeadSchema.safeParse({ [field]: null });
      expect(result.success).toBe(true);
    },
  );

  it('rejects explicit null for title (not nullable, only optional — title cannot be cleared)', () => {
    const result = updateLeadSchema.safeParse({ title: null });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid title when provided', () => {
    const result = updateLeadSchema.safeParse({ title: 'A' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid partial update', () => {
    const result = updateLeadSchema.safeParse({ stageId: VALID_UUID_1, probability: 80 });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid sourceId when provided', () => {
    const result = updateLeadSchema.safeParse({ sourceId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('leadIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(leadIdParamSchema.safeParse({ id: VALID_UUID_1 }).success).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    expect(leadIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects a missing id', () => {
    expect(leadIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('listLeadsQuerySchema', () => {
  it('applies pagination defaults when nothing is provided', () => {
    const result = listLeadsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
    }
  });

  it('accepts stageId/sourceId filters', () => {
    const result = listLeadsQuerySchema.safeParse({ stageId: VALID_UUID_1, sourceId: VALID_UUID_2 });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid stageId', () => {
    const result = listLeadsQuerySchema.safeParse({ stageId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a page below 1', () => {
    const result = listLeadsQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a limit above 100', () => {
    const result = listLeadsQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });
});

describe('convertLeadSchema', () => {
  it('accepts an empty object (notes is optional)', () => {
    expect(convertLeadSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid notes string', () => {
    expect(convertLeadSchema.safeParse({ notes: 'Converted after signed proposal.' }).success).toBe(true);
  });

  it('rejects notes longer than 1000 characters', () => {
    expect(convertLeadSchema.safeParse({ notes: 'A'.repeat(1001) }).success).toBe(false);
  });
});
