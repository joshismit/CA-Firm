// Generic CSV export - builds a CSV string from rows + column definitions, then triggers a browser
// download via a Blob + temporary anchor (the same plain-browser-download pattern already used for
// presigned document downloads - no server round-trip, no new dependency).

export interface CsvColumn<T> {
  header: string
  accessor: (row: T) => string | number | null | undefined
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(',')
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(c.accessor(row))).join(','))
  return [header, ...lines].join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 (e.g. ₹, non-ASCII names) without mangling characters.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportRowsToCsv<T>(rows: T[], columns: CsvColumn<T>[], filename: string): void {
  downloadCsv(filename, toCsv(rows, columns))
}
