// billing-scoped constants (enums, option lists, default values).

export const BILLING_CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
}

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Active',
  PAST_DUE: 'Past Due',
  SUSPENDED: 'Suspended',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
}

/** PRD section 12 - every plan starts with a 7-day free trial. */
export const TRIAL_PERIOD_DAYS = 7
