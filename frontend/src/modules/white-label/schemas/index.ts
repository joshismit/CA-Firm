// Zod schemas for white-label forms. Mirrors backend/src/modules/tenant/schemas/*.ts exactly
// (same hex-color regex, same subdomain/domain rules).
import { z } from 'zod'

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Enter a valid hex color')
  .or(z.literal(''))

export const brandingFormSchema = z.object({
  firmName: z.string().trim().max(255).or(z.literal('')),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  backgroundColor: hexColor,
  supportEmail: z.string().trim().email('Must be a valid email').or(z.literal('')),
  supportPhone: z.string().trim().max(30).or(z.literal('')),
  footerText: z.string().trim().max(500).or(z.literal('')),
})

export type BrandingFormValues = z.infer<typeof brandingFormSchema>

export const subdomainFormSchema = z.object({
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(63, 'Subdomain cannot exceed 63 characters')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Only lowercase letters, numbers, and hyphens (not at the start or end)'),
})

export type SubdomainFormValues = z.infer<typeof subdomainFormSchema>

export const customDomainFormSchema = z.object({
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/, 'Enter a valid domain, e.g. portal.yourfirm.com'),
})

export type CustomDomainFormValues = z.infer<typeof customDomainFormSchema>
