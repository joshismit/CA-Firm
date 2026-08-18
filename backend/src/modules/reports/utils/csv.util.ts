/**
 * Minimal CSV serializer — no external dependency, matching "only implement
 * export if generation already exists" (plain string building needs no new
 * infrastructure, unlike PDF/XLSX, which would require adding a rendering
 * library this backend does not have). Column order is `Object.keys(rows[0])`
 * — the same "columns derive from row keys" convention the frontend's own
 * `ReportDetailPage.tsx` table already uses.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }

  return lines.join('\n');
}
