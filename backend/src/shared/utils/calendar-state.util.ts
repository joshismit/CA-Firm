import { TaskStatus } from '@prisma/client';

/**
 * Work Calendar — a normalized display state for any calendar item (`Task` or
 * `CalendarEvent`), derived on read rather than stored. Genuinely new: no
 * generic OVERDUE/UPCOMING/CURRENTLY_WORKING-style state exists anywhere else
 * in this codebase today — every module computes its own local `isOverdue`
 * boolean (`TaskMapper`, `DashboardAggregationService.toTaskSummaryItem`).
 * This does not replace those — it's a calendar-presentation concern layered
 * on top of the same underlying `Task.status`/`Task.dueDate`, never persisted.
 */
export type CalendarState = 'OVERDUE' | 'PENDING' | 'CURRENTLY_WORKING' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

/** Statuses (from either of `TaskStatus`'s two families — see its own schema
 *  comment) that represent work actively in flight, as opposed to "not yet
 *  started" or "terminal." Status-derived, never date-derived — per the
 *  PRD's explicit instruction not to infer "currently working" from today's
 *  date alone. */
const ACTIVE_STATUSES: TaskStatus[] = [
  TaskStatus.IN_PROGRESS,
  TaskStatus.REVIEW,
  TaskStatus.SUBMITTED,
  TaskStatus.UNDER_REVIEW,
  TaskStatus.APPROVED,
];

/** `Task.dueDate`/`Task.startDate` are `@db.Date` columns stored at UTC
 *  midnight (see `TaskReminderService`'s identical helper and its own
 *  comment on why) — comparing calendar days any other way risks an
 *  off-by-one-day OVERDUE/PENDING/UPCOMING misclassification. */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Maps a Task's real `status` + `dueDate` onto a `CalendarState`.
 *
 * - `COMPLETED`/`CANCELLED` statuses map 1:1 — always, regardless of date.
 * - `IN_PROGRESS`/`REVIEW`/`SUBMITTED`/`UNDER_REVIEW`/`APPROVED` (work
 *   actively in flight in either lifecycle) → `CURRENTLY_WORKING`, always —
 *   never date-derived.
 * - Everything else (`TODO`, `REQUESTED`, and `REJECTED` — REJECTED is NOT
 *   terminal, it re-enters `REQUESTED` on resubmit, exactly like the
 *   existing `isOverdue` boolean's own `!TERMINAL_STATUSES.includes(status)`
 *   already treats it) is "not yet started" — date-derived: no due date →
 *   `UPCOMING`; due date before today → `OVERDUE`; due date is today →
 *   `PENDING`; due date after today → `UPCOMING`.
 */
export function deriveTaskCalendarState(status: TaskStatus, dueDate: Date | null, now: Date = new Date()): CalendarState {
  if (status === TaskStatus.COMPLETED) return 'COMPLETED';
  if (status === TaskStatus.CANCELLED) return 'CANCELLED';
  if (ACTIVE_STATUSES.includes(status)) return 'CURRENTLY_WORKING';

  if (!dueDate) return 'UPCOMING';

  const today = startOfUtcDay(now);
  const due = startOfUtcDay(dueDate);

  if (due.getTime() < today.getTime()) return 'OVERDUE';
  if (due.getTime() === today.getTime()) return 'PENDING';
  return 'UPCOMING';
}

/**
 * Maps a `CalendarEvent`'s `startAt`/`endAt` onto a `CalendarState`. Events
 * have no status field (see the model's own comment — deliberately minimal),
 * so this is purely time-based: past its end time → `COMPLETED`; currently
 * between start and end → `CURRENTLY_WORKING`; otherwise → `UPCOMING`.
 */
export function deriveEventCalendarState(startAt: Date, endAt: Date | null, now: Date = new Date()): CalendarState {
  const end = endAt ?? startAt;
  if (end.getTime() < now.getTime()) return 'COMPLETED';
  if (startAt.getTime() <= now.getTime() && now.getTime() <= end.getTime()) return 'CURRENTLY_WORKING';
  return 'UPCOMING';
}
