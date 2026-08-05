// Major options matching backend users/models.py Major enum
export interface MajorOption {
  code: string
  display: string
}

export const majorOptions: MajorOption[] = [
  { code: 'CS', display: 'Computer Science' },
  { code: 'CH', display: 'Chemistry' },
  { code: 'CE', display: 'Chemical Engineering' },
  { code: 'OGE', display: 'Oil and Gas Engineering' },
  { code: 'GE', display: 'Geophysical Engineering' },
  { code: 'UD', display: 'Undeclared' },
]

/** Year comes back from the API as a string or a number depending on the endpoint. */
export type Year = string | number | null | undefined

// Utility function to get display name from major code
export const getMajorDisplayName = (code: string | null | undefined): string => {
  const major = majorOptions.find((m) => m.code === code)
  return major ? major.display : 'Undeclared'
}

// Utility function to get major code from display name (for backwards compatibility)
export const getMajorCode = (displayName: string | null | undefined): string => {
  const major = majorOptions.find((m) => m.display === displayName)
  return major ? major.code : 'UD'
}

// Utility function to format year display (converts "5" to "Graduate")
export const formatYearDisplay = (year: Year): string => {
  if (!year) return ''
  if (String(year) === '5') return 'Graduate'
  return `Year ${year}`
}

// Utility function to get year display text (for use in "Year X" format)
export const getYearDisplay = (year: Year): string => {
  if (!year) return ''
  if (String(year) === '5') return 'Graduate'
  return String(year)
}

// Utility function to format year with ordinal suffix (1st, 2nd, 3rd, 4th) or "Graduate" for 5
export const formatYearWithOrdinal = (year: Year): string => {
  if (!year) return ''
  if (String(year) === '5') return 'Graduate'
  const num = parseInt(String(year), 10)
  if (isNaN(num)) return String(year)
  const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'
  return `${num}${suffix} Year`
}
