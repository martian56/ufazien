import { Clock, Eye, Gauge, Laptop, Users } from "lucide-react"
// These are chart primitives, not icons. lucide-react exports similarly named
// icons, so importing them from there would have rendered a picture of a chart
// instead of a chart.
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { Website } from "../../utils/hostingApi"

/**
 * Traffic and bandwidth for one website.
 *
 * Every figure on this tab used to be `Math.random()` — visitors, page views,
 * bounce rate, the chart, top pages, traffic sources, device split and a
 * "real-time activity" panel that counted users who did not exist. The real
 * analytics were fetched by `WebsiteDetail`, passed in as a prop, and never
 * read.
 *
 * They are read now. What cannot be measured is said rather than invented:
 * bounce rate and session length need a script running on the visitor's page,
 * and nothing serves one, so they show as not measured instead of as a
 * plausible number nobody can act on.
 */

export interface AnalyticsDay {
  date: string
  page_views?: number
  unique_visitors?: number
  bandwidth_used?: number
}

export interface WebsiteAnalyticsPayload {
  summary?: {
    total_page_views?: number
    total_unique_visitors?: number
    total_bandwidth?: number
    avg_bounce_rate?: number
    avg_session_duration?: number
  }
  daily_data?: AnalyticsDay[]
  top_pages?: { path: string; views: number }[]
  referrers?: { referrer: string; visits: number }[]
  devices?: Record<string, number>
}

interface WebsiteAnalyticsTabProps {
  /** Kept for the call site; the tab shows figures rather than the site. */
  website: Website
  analytics: WebsiteAnalyticsPayload | Record<string, unknown> | null
  /** Whether the request for these figures failed, as opposed to finding none. */
  failed?: boolean
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes < 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/** A `YYYY-MM-DD` day, labelled in the reader's own timezone. */
export function dayLabel(date: string): string {
  // The date alone parses as midnight UTC, which renders as the day before
  // anywhere west of it. The time component makes it local.
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

/**
 * The share each device took, as whole percentages that add to 100.
 *
 * Rounding each one on its own does not: three equal counts round to 33 apiece
 * and the panel shows 99%. The whole part is taken first and what is left over
 * is handed out to the largest remainders, which is the ordinary way of making
 * a set of rounded shares total what they started as.
 */
export function deviceShare(devices: Record<string, number> | undefined) {
  const entries = Object.entries(devices ?? {}).filter(([, count]) => count > 0)
  const total = entries.reduce((sum, [, count]) => sum + count, 0)
  if (total === 0) return []

  const shares = entries
    .sort((a, b) => b[1] - a[1])
    .map(([device, count]) => {
      const exact = (count / total) * 100
      const whole = Math.floor(exact)
      return { device, count, percentage: whole, remainder: exact - whole }
    })

  // Biggest remainders first, so the leftover points go where they are most
  // nearly owed. Ties keep the order above, which is by count.
  let leftover = 100 - shares.reduce((sum, share) => sum + share.percentage, 0)
  for (const share of [...shares].sort((a, b) => b.remainder - a.remainder)) {
    if (leftover <= 0) break
    share.percentage += 1
    leftover -= 1
  }

  return shares.map(({ device, count, percentage }) => ({ device, count, percentage }))
}

function Stat({
  icon,
  tint,
  label,
  value,
  note,
}: {
  icon: React.ReactNode
  tint: string
  label: string
  value: string
  note?: string
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${tint}`}>{icon}</div>
        <div className="ml-4 min-w-0">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {note && <p className="text-xs text-gray-400">{note}</p>}
        </div>
      </div>
    </div>
  )
}

/** Said once, where a panel has nothing in it yet. */
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-gray-400">{children}</p>
}

const DEVICE_COLOURS: Record<string, string> = {
  desktop: "bg-blue-500",
  mobile: "bg-green-500",
  tablet: "bg-purple-500",
}

export default function WebsiteAnalyticsTab({
  analytics,
  failed = false,
}: WebsiteAnalyticsTabProps) {
  const data = (analytics ?? {}) as WebsiteAnalyticsPayload
  const summary = data.summary ?? {}
  const days = data.daily_data ?? []
  const topPages = data.top_pages ?? []
  const referrers = data.referrers ?? []
  const devices = deviceShare(data.devices)

  const chart = days.map((day) => ({
    date: dayLabel(day.date),
    visitors: day.unique_visitors ?? 0,
    pageViews: day.page_views ?? 0,
  }))

  const hasTraffic = (summary.total_page_views ?? 0) > 0

  if (failed) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        These figures could not be loaded just now. That is not the same as there being no
        traffic — try again in a moment.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Stat
          icon={<Users className="h-6 w-6 text-blue-600" />}
          tint="bg-blue-100"
          label="Unique Visitors"
          value={(summary.total_unique_visitors ?? 0).toLocaleString()}
        />
        <Stat
          icon={<Eye className="h-6 w-6 text-green-600" />}
          tint="bg-green-100"
          label="Page Views"
          value={(summary.total_page_views ?? 0).toLocaleString()}
        />
        <Stat
          icon={<Gauge className="h-6 w-6 text-yellow-600" />}
          tint="bg-yellow-100"
          label="Bandwidth"
          value={formatBytes(summary.total_bandwidth)}
        />
        {/* Bounce rate and session length cannot be worked out from a server
            log: a log line is a request, not a session. Saying so beats a
            number that looks measured and is not. */}
        <Stat
          icon={<Clock className="h-6 w-6 text-gray-400" />}
          tint="bg-gray-100"
          label="Bounce Rate · Session"
          value="Not measured"
          note="Needs a script on your pages"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Traffic</h3>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2" />
                <span className="text-gray-600">Visitors</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2" />
                <span className="text-gray-600">Page Views</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            {chart.length === 0 ? (
              <Empty>No traffic recorded yet.</Empty>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPageViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    labelStyle={{ color: "#374151", fontWeight: "medium" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="visitors"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorVisitors)"
                    name="Visitors"
                  />
                  <Area
                    type="monotone"
                    dataKey="pageViews"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPageViews)"
                    name="Page Views"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h3>
          {topPages.length === 0 ? (
            <Empty>Nothing has been read yet.</Empty>
          ) : (
            <div className="space-y-3">
              {topPages.map((page) => (
                <div key={page.path} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-gray-700">{page.path}</span>
                  <span className="shrink-0 text-sm font-medium text-gray-900 tabular-nums">
                    {page.views.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {/* Referrers, which is what a log can tell you — not the invented
              Direct / Google / Social split that was here, whose percentages
              were fixed constants beside random counts. */}
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Where readers came from</h3>
          {referrers.length === 0 ? (
            <Empty>
              {hasTraffic
                ? "Everyone arrived directly, with no referring page."
                : "No traffic recorded yet."}
            </Empty>
          ) : (
            <div className="space-y-3">
              {referrers.map((source) => (
                <div key={source.referrer} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-gray-700">{source.referrer}</span>
                  <span className="shrink-0 text-sm font-medium text-gray-900 tabular-nums">
                    {source.visits.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Laptop className="h-4 w-4 text-gray-400" />
            Device Types
          </h3>
          {devices.length === 0 ? (
            <Empty>No traffic recorded yet.</Empty>
          ) : (
            <div className="space-y-3">
              {devices.map(({ device, count, percentage }) => (
                <div key={device}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="capitalize text-gray-700">{device}</span>
                    <span className="text-gray-500 tabular-nums">
                      {percentage}% · {count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-2 rounded-full ${DEVICE_COLOURS[device] ?? "bg-gray-400"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
