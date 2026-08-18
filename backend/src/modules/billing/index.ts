// billing module — public exports
//
// Alongside the router (for mounting) and DTO types, this module also
// exports `PlanController` and the plan write-schemas — `modules/master-admin`
// composes its own `/master-admin/plans*` routes directly against them
// rather than duplicating Plan CRUD there. `Plan` conceptually belongs to
// billing (the tenant-facing catalog), not to master-admin (which only adds
// a role-gated admin surface on top), so the controller lives here.
// `BillingService`/`PlanService`/repositories/mapper are NOT exported —
// internal implementation details.

export { default as billingRoutes } from './routes/billing.routes';
export { PlanController } from './controller/plan.controller';
export { BILLING_PERMISSIONS } from './constants/billing.permissions';
export { createPlanSchema, updatePlanSchema, planIdParamSchema } from './schemas/billing.schema';
export type {
  CreatePlanDto,
  UpdatePlanDto,
  CreateCheckoutSessionDto,
  VerifyCheckoutPaymentDto,
  ListPlansQueryDto,
  ListInvoicesQueryDto,
} from './dto/billing.req.dto';
export type {
  PlanResponseDto,
  PlanWithTenantCountResponseDto,
  SubscriptionResponseDto,
  CheckoutSessionResponseDto,
  PlatformInvoiceResponseDto,
} from './dto/billing.res.dto';
