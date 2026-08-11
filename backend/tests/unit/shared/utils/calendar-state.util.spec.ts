import { TaskStatus } from '@prisma/client';
import { deriveTaskCalendarState, deriveEventCalendarState } from '@shared/utils';

/**
 * `deriveTaskCalendarState`/`deriveEventCalendarState` — Unit Tests (Work
 * Calendar). Table-driven across every `TaskStatus` × date-boundary
 * combination — the exact mapping documented in `calendar-state.util.ts`'s
 * own header comment.
 */
describe('deriveTaskCalendarState', () => {
  const NOW = new Date('2026-08-11T10:00:00.000Z'); // today = 2026-08-11 UTC
  const YESTERDAY = new Date('2026-08-10T00:00:00.000Z');
  const TODAY = new Date('2026-08-11T00:00:00.000Z');
  const TOMORROW = new Date('2026-08-12T00:00:00.000Z');

  it.each([TaskStatus.COMPLETED])('maps %s to COMPLETED regardless of due date', (status) => {
    expect(deriveTaskCalendarState(status, YESTERDAY, NOW)).toBe('COMPLETED');
    expect(deriveTaskCalendarState(status, null, NOW)).toBe('COMPLETED');
  });

  it.each([TaskStatus.CANCELLED])('maps %s to CANCELLED regardless of due date', (status) => {
    expect(deriveTaskCalendarState(status, YESTERDAY, NOW)).toBe('CANCELLED');
    expect(deriveTaskCalendarState(status, null, NOW)).toBe('CANCELLED');
  });

  it.each([TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.SUBMITTED, TaskStatus.UNDER_REVIEW, TaskStatus.APPROVED])(
    'maps %s to CURRENTLY_WORKING regardless of due date (never date-derived)',
    (status) => {
      expect(deriveTaskCalendarState(status, YESTERDAY, NOW)).toBe('CURRENTLY_WORKING');
      expect(deriveTaskCalendarState(status, TOMORROW, NOW)).toBe('CURRENTLY_WORKING');
      expect(deriveTaskCalendarState(status, null, NOW)).toBe('CURRENTLY_WORKING');
    },
  );

  it.each([TaskStatus.TODO, TaskStatus.REQUESTED, TaskStatus.REJECTED])(
    '%s is date-derived: no due date -> UPCOMING',
    (status) => {
      expect(deriveTaskCalendarState(status, null, NOW)).toBe('UPCOMING');
    },
  );

  it.each([TaskStatus.TODO, TaskStatus.REQUESTED, TaskStatus.REJECTED])(
    '%s is date-derived: due date before today -> OVERDUE',
    (status) => {
      expect(deriveTaskCalendarState(status, YESTERDAY, NOW)).toBe('OVERDUE');
    },
  );

  it.each([TaskStatus.TODO, TaskStatus.REQUESTED, TaskStatus.REJECTED])(
    '%s is date-derived: due date is today -> PENDING',
    (status) => {
      expect(deriveTaskCalendarState(status, TODAY, NOW)).toBe('PENDING');
    },
  );

  it.each([TaskStatus.TODO, TaskStatus.REQUESTED, TaskStatus.REJECTED])(
    '%s is date-derived: due date after today -> UPCOMING',
    (status) => {
      expect(deriveTaskCalendarState(status, TOMORROW, NOW)).toBe('UPCOMING');
    },
  );

  it('treats a due date late on "today" (UTC) as PENDING, not OVERDUE — UTC-day-boundary comparison, not exact-time', () => {
    const lateToday = new Date('2026-08-11T23:59:59.999Z');
    expect(deriveTaskCalendarState(TaskStatus.TODO, TODAY, lateToday)).toBe('PENDING');
  });
});

describe('deriveEventCalendarState', () => {
  const NOW = new Date('2026-08-11T10:00:00.000Z');

  it('returns UPCOMING when the event has not started yet', () => {
    const startAt = new Date('2026-08-11T12:00:00.000Z');
    const endAt = new Date('2026-08-11T13:00:00.000Z');
    expect(deriveEventCalendarState(startAt, endAt, NOW)).toBe('UPCOMING');
  });

  it('returns CURRENTLY_WORKING when now falls between start and end', () => {
    const startAt = new Date('2026-08-11T09:00:00.000Z');
    const endAt = new Date('2026-08-11T11:00:00.000Z');
    expect(deriveEventCalendarState(startAt, endAt, NOW)).toBe('CURRENTLY_WORKING');
  });

  it('returns COMPLETED when the event has ended', () => {
    const startAt = new Date('2026-08-11T07:00:00.000Z');
    const endAt = new Date('2026-08-11T08:00:00.000Z');
    expect(deriveEventCalendarState(startAt, endAt, NOW)).toBe('COMPLETED');
  });

  it('falls back to startAt as the effective end when endAt is null', () => {
    const futureStart = new Date('2026-08-11T12:00:00.000Z');
    expect(deriveEventCalendarState(futureStart, null, NOW)).toBe('UPCOMING');

    const pastStart = new Date('2026-08-11T08:00:00.000Z');
    expect(deriveEventCalendarState(pastStart, null, NOW)).toBe('COMPLETED');
  });
});
