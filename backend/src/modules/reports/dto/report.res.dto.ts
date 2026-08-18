import { ReportType } from './report.req.dto';

/**
 * Response DTO — field-for-field match with the frontend's already-built
 * `ReportResult<TRow>` type (frontend/src/modules/reports/types/index.ts).
 * `rows` is deliberately a loose `Record<string, unknown>[]` — the
 * frontend's own `ReportDetailPage.tsx` renders an arbitrary table from
 * `Object.keys(rows[0])`/`Object.values(row)`, so there is no fixed
 * per-report-type row shape to match beyond "an array of plain objects".
 */
export interface ReportResultResponseDto {
  type: ReportType;
  generatedAt: string;
  rows: Array<Record<string, unknown>>;
  /**
   * PRD §13.2 report #2 (Converted Clients) — a scalar aggregate ("conversion
   * ratio") that doesn't fit as a row. Additive and optional: every other
   * report type omits it entirely, so existing consumers reading only
   * `.rows` are unaffected.
   */
  meta?: Record<string, unknown>;
}
