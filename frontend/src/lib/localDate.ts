/**
 * Calendar dates in the user's own timezone.
 *
 * `date.toISOString().split('T')[0]` is the obvious way to get a YYYY-MM-DD key
 * and it is wrong everywhere east of Greenwich. The calendar grid builds each
 * cell as local midnight, and Baku is UTC+4, so local midnight on the 21st is
 * 20:00 UTC on the 20th: `toISOString()` returned "2026-08-20" for the cell
 * labelled 21, and every event in the calendar rendered a day late for every
 * user in Azerbaijan.
 *
 * The API stores a plain date (`CalendarEvent.date` is a DateField), so the key
 * has to be built from the local parts, never through UTC.
 */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Today, as the same YYYY-MM-DD key. */
export function todayKey(): string {
  return toLocalDateKey(new Date())
}
