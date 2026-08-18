// Work Calendar view-range math. Uses date-fns (already an installed dependency, unused
// elsewhere in the frontend - see the codebase audit) rather than hand-rolling month/week
// boundary arithmetic, which is exactly the class of off-by-one bug the PRD calls out to avoid.
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { CalendarView } from '../types'

const WEEK_STARTS_ON = 1 // Monday - matches the PRD's example calendar layout (MON..FRI).
const AGENDA_DAYS = 14

export interface DateRange {
  from: Date
  to: Date
}

/** The fetch range for a given view - for `month`, includes the leading/trailing days of
 *  adjacent months shown to fill the grid, so items on those visible cells aren't silently missing. */
export function getViewRange(view: CalendarView, anchorDate: Date): DateRange {
  switch (view) {
    case 'month': {
      const monthStart = startOfMonth(anchorDate)
      const monthEnd = endOfMonth(anchorDate)
      return {
        from: startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON }),
        to: endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON }),
      }
    }
    case 'week':
      return {
        from: startOfWeek(anchorDate, { weekStartsOn: WEEK_STARTS_ON }),
        to: endOfWeek(anchorDate, { weekStartsOn: WEEK_STARTS_ON }),
      }
    case 'day':
      return { from: startOfDay(anchorDate), to: endOfDay(anchorDate) }
    case 'agenda':
      return { from: startOfDay(anchorDate), to: endOfDay(addDays(anchorDate, AGENDA_DAYS - 1)) }
  }
}

/** Every calendar-grid day cell for the given view (month: full 6-week grid, week: 7 days, day: 1 day, agenda: the 14-day window). */
export function getGridDays(view: CalendarView, anchorDate: Date): Date[] {
  const range = getViewRange(view, anchorDate)
  return eachDayOfInterval({ start: range.from, end: range.to })
}

/** Moves the anchor date one view-unit forward/backward - "Today"/prev/next navigation. */
export function shiftAnchorDate(view: CalendarView, anchorDate: Date, direction: 1 | -1): Date {
  switch (view) {
    case 'month':
      return addMonths(anchorDate, direction)
    case 'week':
      return addWeeks(anchorDate, direction)
    case 'day':
      return addDays(anchorDate, direction)
    case 'agenda':
      return addDays(anchorDate, direction * AGENDA_DAYS)
  }
}
