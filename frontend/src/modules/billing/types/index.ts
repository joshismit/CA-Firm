// TypeScript types and interfaces scoped to billing.
// The Tenant Prisma model already has planCode/subscriptionStatus/subscriptionExpiresAt fields,
// but there is no Subscription/Invoice/Payment table or backend module yet - these types follow
// the PRD's plan/trial/Razorpay description (section 12) and are provisional.

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED'

export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

export type InvoiceStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'VOID'

export interface SubscriptionPlan {
  code: string
  name: string
  billingCycle: BillingCycle
  priceInPaise: number
  maxUsers: number | null
  maxClients: number | null
  maxStorageGb: number | null
}

export interface Subscription {
  planCode: string
  status: SubscriptionStatus
  expiresAt: string | null
  trialEndsAt: string | null
}

export interface Invoice {
  id: string
  number: string
  amountInPaise: number
  status: InvoiceStatus
  issuedAt: string
  dueAt: string
}

export interface InvoiceListFilters {
  page?: number
  limit?: number
  status?: InvoiceStatus
}

export interface CreateCheckoutSessionPayload {
  planCode: string
  billingCycle: BillingCycle
}

export interface CheckoutSession {
  /** Razorpay (or future provider) checkout session/order id to hand off to their client SDK. */
  sessionId: string
  redirectUrl: string
}
