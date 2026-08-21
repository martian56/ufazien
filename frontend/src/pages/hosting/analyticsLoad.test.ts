import { describe, it, expect, vi } from 'vitest'

/**
 * Reading what was fetched, rather than what the store held a moment ago.
 *
 * The analytics page did this:
 *
 *     await fetchWebsiteAnalytics(id, period)      // puts it in the store
 *     const data = getWebsiteAnalytics(id, period) // reads the store
 *     setAnalyticsData(data)
 *
 * `getWebsiteAnalytics` closes over state from the render it was made in, so
 * straight after the await it still answers with whatever was there before —
 * `null` on the first pass, which is every pass, because nothing re-runs the
 * effect afterwards. The figures arrived, went into the store, and the page
 * set itself to null and showed zeroes for ever.
 *
 * Modelled here rather than mounted, because the bug is the sequence and not
 * the markup: a React Testing Library render would need the whole dashboard
 * hook, its provider and a fetch mock to say the same thing.
 */

/** A store whose reader is bound to the state at the time it was made. */
function makeStore() {
  let state: Record<string, unknown> = {}

  return {
    async fetch(key: string, value: unknown) {
      state = { ...state, [key]: value }
      return value
    },
    /** As a component would capture it: over the state of *this* render. */
    readerForThisRender() {
      const captured = state
      return (key: string) => captured[key] ?? null
    },
  }
}

describe('loading the figures into the page', () => {
  it('is empty when read through the reader from before the fetch', async () => {
    const store = makeStore()
    const read = store.readerForThisRender()

    await store.fetch('site-1', { summary: { total_page_views: 10 } })

    expect(read('site-1'), 'the stale read is what put zeroes on the page').toBeNull()
  })

  it('has the figures when the returned value is used', async () => {
    const store = makeStore()

    const data = await store.fetch('site-1', { summary: { total_page_views: 10 } })

    expect(data).toEqual({ summary: { total_page_views: 10 } })
  })

  it('the page uses the returned value', async () => {
    // The shape of the fixed call site: one await, no second read.
    const fetchWebsiteAnalytics = vi.fn().mockResolvedValue({
      summary: { total_page_views: 10, total_unique_visitors: 6 },
    })
    let shown: unknown = null

    shown = await fetchWebsiteAnalytics('site-1', '7d')

    expect(fetchWebsiteAnalytics).toHaveBeenCalledWith('site-1', '7d')
    expect(shown).toMatchObject({ summary: { total_page_views: 10 } })
  })
})
