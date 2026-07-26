// App-wide static configuration (app name, support email, default page size, locale, financial-year start month).

export const appConfig = {
  appName: 'CA Firm ERP',
  supportEmail: 'support@ca-erp.app',
  defaultPageSize: 20,
  locale: 'en-IN',
  financialYearStartMonth: 4, // April
} as const
