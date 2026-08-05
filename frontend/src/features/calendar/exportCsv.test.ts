import { describe, expect, it } from 'vitest'
import { escapeCsvField, eventsToCsv } from './exportCsv'

describe('escapeCsvField', () => {
  it('leaves ordinary text alone', () => {
    expect(escapeCsvField('Lecture')).toBe('Lecture')
  })

  it('quotes a field containing a comma', () => {
    // This is the bug: an unquoted comma shifted every later column along.
    expect(escapeCsvField('Lecture, room 3')).toBe('"Lecture, room 3"')
  })

  it('doubles quotes inside a quoted field', () => {
    expect(escapeCsvField('He said "hi"')).toBe('"He said ""hi"""')
  })

  it('quotes a field containing a newline', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"')
  })

  it('renders null and undefined as empty, not as the words', () => {
    expect(escapeCsvField(null)).toBe('')
    expect(escapeCsvField(undefined)).toBe('')
  })
})

describe('eventsToCsv', () => {
  it('keeps the columns aligned when a title contains a comma', () => {
    const csv = eventsToCsv([
      {
        title: 'Lecture, room 3',
        description: 'Bring the handout',
        date: '2026-03-01',
        startTime: '09:00',
        endTime: '10:30',
        location: 'Block A',
        category: 'class',
        priority: 'high',
      },
    ])

    const [, row] = csv.split('\r\n')
    expect(row).toBe('"Lecture, room 3",Bring the handout,2026-03-01,09:00,10:30,Block A,class,high')
    // Eight columns even though the title itself contains a comma.
    expect(row.match(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g)?.length).toBe(7)
  })

  it('writes a header even with no events', () => {
    expect(eventsToCsv([])).toBe('Title,Description,Date,Start Time,End Time,Location,Category,Priority')
  })

  it('leaves missing fields empty rather than writing undefined', () => {
    const csv = eventsToCsv([{ title: 'Bare' }])
    expect(csv.split('\r\n')[1]).toBe('Bare,,,,,,,')
  })
})
