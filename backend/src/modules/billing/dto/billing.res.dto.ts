import { BillingCycle, PlatformInvoiceStatus, SubscriptionStatus, TenantStatus } from '@prisma/client';

/**
 * Response DTOs — deliberately omit internal-only fields. Dates are
 * serialised to ISO strings rather than leaking Prisma `Date` objects.
 */

export interface PlanResponseDto {
  id: string;
  code: string;
  name: string;
  billingCycle: BillingCycle;
  priceInPaise: number;
  maxUsers: number | null;
  maxClients: number | null;
  maxStorageGb: number | null;
  maxDocuments: number | null;
  isActive: boolean;
  displayOrder: number;
}

/** Master-admin-only view — includes how many tenants are currently on this plan. */
export interface PlanWithTenantCountResponseDto extends PlanResponseDto {
  tenantCount: number;
}

export interface SubscriptionResponseDto {
  status: TenantStatus;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  plan: PlanResponseDto | null;
}

export interface CheckoutSessionResponseDto {
  invoiceId: string;
  razorpayOrderId: string;
  amountInPaise: number;
  currency: string;
  razorpayKeyId: string;
}

export interface PlatformInvoiceResponseDto {
  id: string;
  planCode: string;
  planName: string;
  billingCycle: BillingCycle;
  amountInPaise: number;
  status: PlatformInvoiceStatus;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  createdAt: string;
  paidAt: string | null;
}
