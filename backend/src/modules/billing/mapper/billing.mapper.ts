import { Plan, PlatformInvoice, SubscriptionStatus, Tenant, TenantStatus } from '@prisma/client';
import {
  PlanResponseDto,
  PlanWithTenantCountResponseDto,
  PlatformInvoiceResponseDto,
  SubscriptionResponseDto,
} from '../dto/billing.res.dto';

export type PlanWithTenantCount = Plan & { tenantCount: number };
export type PlatformInvoiceWithPlan = PlatformInvoice & { plan: Plan };

export class BillingMapper {
  static toPlanResponseDto(plan: Plan): PlanResponseDto {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      billingCycle: plan.billingCycle,
      priceInPaise: plan.priceInPaise,
      maxUsers: plan.maxUsers,
      maxClients: plan.maxClients,
      maxStorageGb: plan.maxStorageGb,
      maxDocuments: plan.maxDocuments,
      maxUploadSizeMb: plan.maxUploadSizeMb,
      isActive: plan.isActive,
      displayOrder: plan.displayOrder,
    };
  }

  static toPlanResponseDtoList(plans: Plan[]): PlanResponseDto[] {
    return plans.map((plan) => this.toPlanResponseDto(plan));
  }

  static toPlanWithTenantCountResponseDto(plan: PlanWithTenantCount): PlanWithTenantCountResponseDto {
    return { ...this.toPlanResponseDto(plan), tenantCount: plan.tenantCount };
  }

  static toPlanWithTenantCountResponseDtoList(plans: PlanWithTenantCount[]): PlanWithTenantCountResponseDto[] {
    return plans.map((plan) => this.toPlanWithTenantCountResponseDto(plan));
  }

  static toSubscriptionResponseDto(
    tenant: Pick<Tenant, 'status' | 'subscriptionStatus' | 'subscriptionExpiresAt'>,
    plan: Plan | null,
  ): SubscriptionResponseDto {
    return {
      status: tenant.status as TenantStatus,
      subscriptionStatus: tenant.subscriptionStatus as SubscriptionStatus,
      subscriptionExpiresAt: tenant.subscriptionExpiresAt ? tenant.subscriptionExpiresAt.toISOString() : null,
      plan: plan ? this.toPlanResponseDto(plan) : null,
    };
  }

  static toInvoiceResponseDto(invoice: PlatformInvoiceWithPlan): PlatformInvoiceResponseDto {
    return {
      id: invoice.id,
      planCode: invoice.plan.code,
      planName: invoice.plan.name,
      billingCycle: invoice.billingCycle,
      amountInPaise: invoice.amountInPaise,
      status: invoice.status,
      razorpayOrderId: invoice.razorpayOrderId,
      razorpayPaymentId: invoice.razorpayPaymentId,
      createdAt: invoice.createdAt.toISOString(),
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    };
  }

  static toInvoiceResponseDtoList(invoices: PlatformInvoiceWithPlan[]): PlatformInvoiceResponseDto[] {
    return invoices.map((invoice) => this.toInvoiceResponseDto(invoice));
  }
}
