import { describe, it, expect } from 'vitest'
import { DESTINATIONS, matchDestinations } from './destinations'

describe('matchDestinations', () => {
  it('returns nothing for an empty query', () => {
    expect(matchDestinations('')).toEqual([])
    expect(matchDestinations('   ')).toEqual([])
  })

  it('finds a page by an exact title', () => {
    expect(matchDestinations('SSL')[0].url).toBe('/hosting/ssl')
  })

  it('finds a page by a keyword rather than its title', () => {
    expect(matchDestinations('certificate')[0].url).toBe('/hosting/ssl')
    expect(matchDestinations('tldr')[0].url).toBe('/ai-tools/summarizer')
    expect(matchDestinations('coefficient')[0].url).toBe('/average-calculator')
  })

  it('ranks a title prefix above a keyword hit', () => {
    const titles = matchDestinations('bl').map((d) => d.title)
    expect(titles[0]).toBe('Blog')
  })

  it('ranks a whole-word keyword above a mid-word title match', () => {
    const titles = matchDestinations('grade').map((d) => d.title)
    expect(titles[0]).toBe('GPA Calculator')
    expect(titles).toContain('Upgrade plan')
  })

  it('is case insensitive', () => {
    expect(matchDestinations('GRAMMAR')[0].url).toBe('/ai-tools/grammar-checker')
  })

  it('honours the limit', () => {
    expect(matchDestinations('a', 3).length).toBeLessThanOrEqual(3)
  })

  it('every destination has a route, a group and keywords', () => {
    for (const d of DESTINATIONS) {
      expect(d.url.startsWith('/')).toBe(true)
      expect(d.group).toBeTruthy()
      expect(d.keywords.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate routes', () => {
    const urls = DESTINATIONS.map((d) => d.url)
    expect(new Set(urls).size).toBe(urls.length)
  })
})
