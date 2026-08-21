import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import WebsiteAnalyticsTab, {
  dayLabel,
  deviceShare,
  formatBytes,
  type WebsiteAnalyticsPayload,
} from './WebsiteAnalyticsTab'
import type { Website } from '../../utils/hostingApi'

const website = { id: 'abc', name: 'Portfolio' } as unknown as Website

const payload: WebsiteAnalyticsPayload = {
  summary: {
    total_page_views: 1234,
    total_unique_visitors: 321,
    total_bandwidth: 5_242_880,
  },
  daily_data: [
    { date: '2026-08-20', page_views: 700, unique_visitors: 200 },
    { date: '2026-08-21', page_views: 534, unique_visitors: 121 },
  ],
  top_pages: [
    { path: '/', views: 900 },
    { path: '/about', views: 334 },
  ],
  referrers: [{ referrer: 'https://news.example.com/story', visits: 42 }],
  devices: { desktop: 60, mobile: 30, tablet: 10 },
}

/**
 * Every figure on this tab used to be `Math.random()` — and the real analytics
 * were fetched, passed in as a prop, and never read.
 */
describe('the figures on the tab', () => {
  it('shows the visitors and views it was given', () => {
    render(<WebsiteAnalyticsTab website={website} analytics={payload} />)

    expect(screen.getByText('321')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('shows the pages that were actually read', () => {
    render(<WebsiteAnalyticsTab website={website} analytics={payload} />)

    expect(screen.getByText('/about')).toBeInTheDocument()
    expect(screen.getByText('900')).toBeInTheDocument()
  })

  it('shows the real referrer rather than an invented source split', () => {
    render(<WebsiteAnalyticsTab website={website} analytics={payload} />)

    expect(screen.getByText('https://news.example.com/story')).toBeInTheDocument()
    // The panel it replaces listed Direct / Google / Social Media / Referrals
    // with fixed percentages beside random counts.
    expect(screen.queryByText('Social Media')).not.toBeInTheDocument()
  })

  it('does not invent a bounce rate or a session length', () => {
    // A log line is a request, not a session; neither can be worked out from
    // one. Saying so beats a number that looks measured.
    render(<WebsiteAnalyticsTab website={website} analytics={payload} />)

    expect(screen.getByText(/not measured/i)).toBeInTheDocument()
    expect(screen.getByText(/needs a script on your pages/i)).toBeInTheDocument()
  })

  it('claims nothing about real-time activity', () => {
    // There was a panel counting "users online" that nothing measured.
    render(<WebsiteAnalyticsTab website={website} analytics={payload} />)

    expect(screen.queryByText(/real-time/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/users online/i)).not.toBeInTheDocument()
  })
})

describe('a site with no traffic yet', () => {
  it('says so instead of drawing something', () => {
    render(<WebsiteAnalyticsTab website={website} analytics={{}} />)

    expect(screen.getAllByText(/no traffic recorded yet/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })

  it('survives being handed nothing at all', () => {
    // `WebsiteDetail` passes null while the request is in flight, and an older
    // deployment may answer without the newer fields.
    expect(() =>
      render(<WebsiteAnalyticsTab website={website} analytics={null} />),
    ).not.toThrow()
  })

  it('tells a site with visits but no referrers what that means', () => {
    render(
      <WebsiteAnalyticsTab
        website={website}
        analytics={{ summary: { total_page_views: 10 }, referrers: [] }}
      />,
    )

    expect(screen.getByText(/arrived directly/i)).toBeInTheDocument()
  })
})

describe('when the figures could not be loaded', () => {
  it('says so rather than reporting no traffic', () => {
    // The page used to substitute an empty week here, so a failed request
    // looked exactly like a site nobody has visited.
    render(<WebsiteAnalyticsTab website={website} analytics={null} failed />)

    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument()
    expect(screen.queryByText(/no traffic recorded yet/i)).not.toBeInTheDocument()
  })
})

describe('reading the numbers', () => {
  it('sizes bandwidth in something a person can read', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(5_242_880)).toBe('5.0 MB')
    expect(formatBytes(undefined)).toBe('0 B')
  })

  it('labels a day in the reader’s own timezone', () => {
    // `YYYY-MM-DD` alone is midnight UTC, which renders as the day before
    // anywhere west of it.
    expect(dayLabel('2026-08-20')).toBe(
      new Date(2026, 7, 20).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    )
  })

  it('turns device counts into shares that add up', () => {
    const share = deviceShare({ desktop: 60, mobile: 30, tablet: 10 })

    expect(share.map((d) => d.device)).toEqual(['desktop', 'mobile', 'tablet'])
    expect(share.reduce((total, d) => total + d.percentage, 0)).toBe(100)
  })

  it('has nothing to show when nothing was counted', () => {
    expect(deviceShare({})).toEqual([])
    expect(deviceShare(undefined)).toEqual([])
    expect(deviceShare({ desktop: 0 })).toEqual([])
  })
})
