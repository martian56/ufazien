/**
 * CSV writing, shared by everything that offers a download.
 *
 * Two places built their own and both got the escaping wrong in different
 * ways: the calendar joined fields with a bare comma, so a title like
 * "Lecture, room 3" shifted every later column along; the hosting logs
 * wrapped fields in quotes but never doubled the quotes inside them, so a log
 * message containing one broke its row.
 *
 * RFC 4180: quote a field when it contains a comma, a quote or a newline, and
 * double any quote within it.
 */

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** A header row followed by one row per record, in the given column order. */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string }[]
): string {
  const header = columns.map((column) => escapeCsvField(column.header)).join(',')
  const body = rows.map((row) => columns.map((column) => escapeCsvField(row[column.key])).join(','))
  // Excel and Sheets both expect CRLF, and it is what the RFC specifies.
  return [header, ...body].join('\r\n')
}

export function downloadCsv(csv: string, filename: string): void {
  // The BOM is what makes Excel read this as UTF-8 rather than the local
  // codepage, which otherwise mangles any non-ASCII text.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Without this the blob is held for the lifetime of the document.
  URL.revokeObjectURL(url)
}
