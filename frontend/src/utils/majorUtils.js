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
