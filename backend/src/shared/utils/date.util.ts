/**
 * PRD §11.12 — the `bucket` column on `InvoiceReminder`/`ComplianceReminder`/
 * `DocumentRequestReminder` uses this to dedupe the recurring `OVERDUE` reminder type to once
 * per calendar week per entity per user, while the three one-shot types (30-day/7-day/tomorrow)
 * use a fixed `""` bucket instead (see each of those tables' schema comments). Shared across all
 * three reminder services from the start — not a premature abstraction, it's the same real
 * computation needed identically by each.
 */
export function getIsoWeekLabel(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO weeks start on Monday; shift so Sunday (0) becomes 7.
  const isoDayOfWeek = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - isoDayOfWeek);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}
