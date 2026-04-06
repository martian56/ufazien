// Major options matching backend users/models.py Major enum
export const majorOptions = [
  { code: 'CS', display: 'Computer Science' },
  { code: 'CH', display: 'Chemistry' },
  { code: 'CE', display: 'Chemical Engineering' },
  { code: 'OGE', display: 'Oil and Gas Engineering' },
  { code: 'GE', display: 'Geophysical Engineering' },
  { code: 'UD', display: 'Undeclared' }
]

// Utility function to get display name from major code
export const getMajorDisplayName = (code) => {
  const major = majorOptions.find(m => m.code === code)
  return major ? major.display : 'Undeclared'
}

// Utility function to get major code from display name (for backwards compatibility)
export const getMajorCode = (displayName) => {
  const major = majorOptions.find(m => m.display === displayName)
  return major ? major.code : 'UD'
}

// Utility function to format year display (converts "5" to "Graduate")
export const formatYearDisplay = (year) => {
  if (!year) return ''
  if (year === '5') return 'Graduate'
  return `Year ${year}`
}

// Utility function to get year display text (for use in "Year X" format)
export const getYearDisplay = (year) => {
  if (!year) return ''
  if (year === '5') return 'Graduate'
  return year
}

// Utility function to format year with ordinal suffix (1st, 2nd, 3rd, 4th) or "Graduate" for 5
export const formatYearWithOrdinal = (year) => {
  if (!year) return ''
  if (year === '5') return 'Graduate'
  const num = parseInt(year)
  if (isNaN(num)) return year
  const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'
  return `${num}${suffix} Year`
}
