// TypeScript types and interfaces scoped to billing.
// Field-for-field match with backend/src/modules/billing/dto/billing.res.dto.ts - the platform
// subscription billing backend module is real and mounted at /subscription (backend/src/modules/
// billing), not /billing (that prefix belongs to modules/client-billing, an unrelated domain).

export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED'

export type PlatformInvoiceStatus = 'PENDING' | 'PAID' | 'FAILED' | 'VOID'

export interface SubscriptionPlan {
  id: string
  code: string
  name: string
  billingCycle: BillingCycle
  priceInPaise: number
  maxUsers: number | null
  maxClients: number | null
  maxStorageGb: number | null
  maxDocuments: number | null
  isActive: boolean
  displayOrder: number
}

/** Master-admin-only view — GET /master-admin/plans. */
export interface AdminPlan extends SubscriptionPlan {
  tenantCount: number
}

export interface Subscription {
  subscriptionStatus: SubscriptionStatus
  subscriptionExpiresAt: string | null
  plan: SubscriptionPlan | null
}

export interface Invoice {
  id: string
  planCode: string
  planName: string
  billingCycle: BillingCycle
  amountInPaise: number
  status: PlatformInvoiceStatus
  razorpayOrderId: string
  razorpayPaymentId: string | null
  createdAt: string
  paidAt: string | null
}

export interface InvoiceListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface CreateCheckoutSessionPayload {
  planCode: string
}

export interface CheckoutSession {
  invoiceId: string
  /** Razorpay order id to hand off to Checkout.js. */
  razorpayOrderId: string
  amountInPaise: number
  currency: string
  /** Razorpay's public key id — safe to expose client-side, required by Checkout.js. */
  razorpayKeyId: string
}

export interface VerifyCheckoutPaymentPayload {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

// ─── Master-admin plan management ───────────────────────────────────────────────

export interface CreatePlanPayload {
  code: string
  name: string
  billingCycle: BillingCycle
  priceInPaise: number
  maxUsers?: number | null
  maxClients?: number | null
  maxStorageGb?: number | null
  maxDocuments?: number | null
  displayOrder?: number
}

export interface UpdatePlanPayload {
  name?: string
  priceInPaise?: number
  maxUsers?: number | null
  maxClients?: number | null
  maxStorageGb?: number | null
  maxDocuments?: number | null
  displayOrder?: number
  isActive?: boolean
}
