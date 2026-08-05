/**
 * Calendar export.
 *
 * The previous version joined every field with a comma and no escaping, so a
 * single event titled "Lecture, room 3" pushed every later column of that row
 * one place along. Titles, descriptions and locations are free text, so this
 * was the common case rather than the edge case. Newlines in a description
 * broke the row apart entirely.
 *
 * RFC 4180: wrap a field in quotes when it contains a comma, a quote or a
 * newline, and double any quote inside it.
 */

export interface ExportableEvent {
  title?: string | null
  description?: string | null
  date?: string | null
  startTime?: string | null
  endTime?: string | null
  location?: string | null
  category?: string | null
  priority?: string | null
}

const COLUMNS = [
  'Title',
  'Description',
  'Date',
  'Start Time',
  'End Time',
  'Location',
  'Category',
  'Priority',
]

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function eventsToCsv(events: ExportableEvent[]): string {
  const rows = events.map((event) =>
    [
      event.title,
      event.description,
      event.date,
      event.startTime,
      event.endTime,
      event.location,
      event.category,
      event.priority,
    ]
      .map(escapeCsvField)
      .join(',')
  )
  // Excel and Sheets both expect CRLF, and it is what the RFC specifies.
  return [COLUMNS.join(','), ...rows].join('\r\n')
}

export function downloadCsv(csv: string, filename: string): void {
  // The BOM is what makes Excel read this as UTF-8 rather than the local
  // codepage, which otherwise mangles any non-ASCII title.
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
