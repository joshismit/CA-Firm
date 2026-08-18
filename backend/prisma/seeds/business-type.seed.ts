import { PrismaClient } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Business Type Seed
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `BusinessType` is a shared (cross-tenant) reference table with no seed data
 * yet — without it, `POST /business` always 409s (typeId foreign key
 * violation) and the frontend's Business Type picker has nothing to show.
 *
 * The codes/names below are not invented here — they exactly match the list
 * the frontend has carried since Phase 5 as a client-side placeholder
 * (`frontend/src/modules/business/constants/index.ts` → `BUSINESS_TYPE_OPTIONS`,
 * itself sourced from the PRD). Seeding the same list server-side keeps both
 * sides in agreement instead of the frontend guessing at values that don't
 * exist in the database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface BusinessTypeDefinition {
  code: string;
  name: string;
  description: string;
}

const BUSINESS_TYPE_DEFINITIONS: BusinessTypeDefinition[] = [
  { code: 'INDIVIDUAL', name: 'Individual', description: 'A single individual, not a registered entity.' },
  { code: 'PROPRIETORSHIP', name: 'Proprietorship', description: 'Sole proprietorship business.' },
  { code: 'PARTNERSHIP', name: 'Partnership', description: 'Registered or unregistered partnership firm.' },
  { code: 'LLP', name: 'LLP', description: 'Limited Liability Partnership.' },
  { code: 'PRIVATE_LIMITED', name: 'Private Limited', description: 'Private limited company.' },
  { code: 'PUBLIC_LIMITED', name: 'Public Limited', description: 'Public limited company.' },
  { code: 'OPC', name: 'One Person Company', description: 'One Person Company (OPC).' },
  { code: 'TRUST', name: 'Trust', description: 'Registered trust.' },
  { code: 'SOCIETY', name: 'Society', description: 'Registered society.' },
  { code: 'NGO', name: 'NGO / Section 8 Company', description: 'Non-governmental organisation or Section 8 company.' },
  { code: 'HUF', name: 'HUF', description: 'Hindu Undivided Family.' },
  { code: 'OTHER', name: 'Other', description: 'Any business type not covered by the above.' },
];

/**
 * Seeds every `BusinessType` row. Idempotent — upserts on the unique `code`
 * column instead of inserting duplicates.
 */
export async function seedBusinessTypes(prisma: PrismaClient): Promise<void> {
  for (const def of BUSINESS_TYPE_DEFINITIONS) {
    await prisma.businessType.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, isActive: true },
      create: { code: def.code, name: def.name, description: def.description, isActive: true },
    });
  }
}
