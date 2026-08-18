import { DashboardWidgetDataId } from '../constants/dashboard-widget-ids';

/** `GET /dashboard` — a compact counts-only bundle so the shell page can render badge numbers in one round trip. */
export interface DashboardOverviewResponseDto {
  pendingWorksCount: number;
  dueDatesCount: number;
  paymentRemindersCount: number;
  complianceDeadlinesCount: number;
  assignedClientsCount: number;
  outstandingPaymentsCount: number;
  outstandingPaymentsTotal: number;
  generatedAt: string;
}

export interface TaskSummaryItem {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  isOverdue: boolean;
}

export interface InvoiceSummaryItem {
  id: string;
  invoiceNumber: string;
  businessName: string | null;
  amount: number;
  dueDate: string | null;
  status: string;
}

export interface ComplianceFilingSummaryItem {
  id: string;
  category: string;
  reference: string;
  period: string;
  status: string;
  dueDate: string | null;
}

export interface ClientSummaryItem {
  id: string;
  businessId: string;
  businessName: string | null;
  status: string;
}

export type DashboardWidgetItem = TaskSummaryItem | InvoiceSummaryItem | ComplianceFilingSummaryItem | ClientSummaryItem;

export interface DashboardWidgetDataEntry {
  items: DashboardWidgetItem[];
  total: number;
  totalAmount?: number;
}

/** `GET /dashboard/widgets` — only the requested ids are present as keys. */
export type DashboardWidgetDataResponseDto = Partial<Record<DashboardWidgetDataId, DashboardWidgetDataEntry>>;

export interface CalendarEntry {
  id: string;
  type: 'task' | 'compliance' | 'invoice';
  title: string;
  date: string;
  href: string;
}

export interface DashboardCalendarResponseDto {
  items: CalendarEntry[];
}

export interface ActivityEntry {
  id: string;
  eventType: string;
  description: string;
  actorName: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
}

export interface DashboardActivityResponseDto {
  items: ActivityEntry[];
}

export interface StaffAssignmentSummaryRow {
  [key: string]: unknown;
}

export interface DashboardPerformanceResponseDto {
  range: { from: string; to: string };
  tasks: {
    completed: number;
    pending: number;
    overdue: number;
  };
  documentsUploaded: number;
  pendingPayments: number;
  /** Only present for unrestricted roles (TENANT_ADMIN/MANAGER/MASTER_ADMIN) — PRD §10.11. */
  staffBreakdown: StaffAssignmentSummaryRow[] | null;
}
