import { useState, useEffect, useMemo } from "react"
import type { Website } from "../../utils/hostingApi"
import { errorMessage } from "../../lib/api/errors"

/** What /hosting/analytics/ returns for one website. */
interface AnalyticsDay {
  date: string
  page_views?: number
  unique_visitors?: number
  bounce_rate?: number
  avg_session_duration?: number
  bandwidth_used?: number
}

/**
 * What `/websites/<id>/analytics/` returns.
 *
 * The day-by-day figures come back as `daily_data`, a list in date order. This
 * used to declare an `analytics` map keyed by date, which the endpoint has
 * never sent — so the traffic chart read `undefined` and drew nothing however
 * much traffic a site had.
 */
interface WebsiteAnalytics {
  daily_data?: AnalyticsDay[]
  summary?: {
    total_page_views?: number
    total_unique_visitors?: number
    avg_bounce_rate?: number
    avg_session_duration?: number
    total_bandwidth?: number
  }
}
import { useNavigate } from "react-router-dom"
import { 
  BarChart3, 
  Globe, 
  Users, 
  TrendingUp, 
  Activity, 
  Calendar,
  Download,
  Upload,
  Clock,
  Eye,
  Zap,
  Server,
  Filter
} from "lucide-react"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import { Helmet } from "react-helmet"
import HostingSidebar from "../../components/hosting/HostingSidebar"
import { useWebsites } from "../../hooks/useWebsites"
import { useDashboard } from "../../hooks/useDashboard"
import { useSubscription } from "../../hooks/useSubscription"
import Select from "../../components/ui/Select"

export default function Analytics() {
  const navigate = useNavigate()
  const { websites, loading: websitesLoading } = useWebsites()
  const { 
    fetchWebsiteAnalytics, 
    fetchBandwidthUsage, 
    getWebsiteAnalytics, 
    getBandwidthAnalytics 
  } = useDashboard()
  const { getBandwidthUsage } = useSubscription()
  
  const [loading, setLoading] = useState(true)
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('7d')
  const [analyticsData, setAnalyticsData] = useState<WebsiteAnalytics | null>(null)
  const [bandwidthData, setBandwidthData] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)

        // Load bandwidth usage
        if (fetchBandwidthUsage) {
          await fetchBandwidthUsage(selectedPeriod)
          if (getBandwidthAnalytics) {
            const bandwidth = getBandwidthAnalytics(selectedPeriod)
            setBandwidthData(bandwidth)
          }
        }

        // Load website analytics if a website is selected
        if (selectedWebsite && fetchWebsiteAnalytics && getWebsiteAnalytics) {
          await fetchWebsiteAnalytics(selectedWebsite.id, selectedPeriod)
          const websiteAnalytics = getWebsiteAnalytics(selectedWebsite.id, selectedPeriod)
          setAnalyticsData(websiteAnalytics)
        }

      } catch (err) {
        setError(errorMessage(err, 'Failed to load analytics'))
      } finally {
        setLoading(false)
      }
    }

    if (!websitesLoading && selectedWebsite) {
      loadAnalytics()
    } else if (!websitesLoading && websites.length === 0) {
      // Only stop here when there is genuinely nothing to select. Dropping out
      // of loading while the effect below is still about to pick the first
      // website showed the page, then the skeleton again.
      setLoading(false)
    }
  }, [selectedWebsite?.id, selectedPeriod, websitesLoading, websites.length])

  // Auto-select first website when websites load
  useEffect(() => {
    if (!websitesLoading && !selectedWebsite && websites && websites.length > 0) {
      setSelectedWebsite(websites[0])
    }
  }, [websites, websitesLoading, selectedWebsite])

  // Format numbers for display
  const formatNumber = (num?: number | null) => {
    if (!num) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  // Format bytes
  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return '0 B'
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  // Get mock data for demonstration (until real analytics data is available)
  /**
   * The real figures, from what the endpoint actually returns.
   *
   * This block used to be `mockData`: Math.random() visitors, page views,
   * bounce rate and a week of invented traffic, regenerated whenever the
   * website changed. Every metric was rendered as
   * `analyticsData?.visitors || mockData.visitors`, and since the API sends
   * summary.total_unique_visitors rather than `visitors`, the real value was
   * always undefined and the dice roll always won. Nobody has ever seen their
   * own traffic on this page.
   */
  const summary = analyticsData?.summary
  const trafficData = useMemo(() => {
    // `daily_data`, which is what the endpoint actually returns — a list, one
    // entry per day, already in order. This read `analytics` and treated it as
    // an object keyed by date; there is no such key, so the chart stayed empty
    // whatever the traffic was. The summary cards above it worked, which is
    // what made it look like a chart with nothing to show rather than a chart
    // reading the wrong field.
    const days = analyticsData?.daily_data ?? []
    return days.map((day) => ({
      date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: day.date,
      visitors: day.unique_visitors ?? 0,
      pageViews: day.page_views ?? 0,
      bounceRate: day.bounce_rate ?? 0,
      // Stored in bytes, charted in MB.
      bandwidth: Math.round((day.bandwidth_used ?? 0) / (1024 * 1024)),
    }))
  }, [analyticsData])

  // Memoize bandwidth usage to prevent multiple function calls
  const bandwidthUsage = useMemo(() => {
    try {
      return getBandwidthUsage() || { used: '0 MB', limit: '1 GB', percentage: 0 }
    } catch (error) {
      console.warn('Error getting bandwidth usage:', error)
      return { used: '0 MB', limit: '1 GB', percentage: 0 }
    }
  }, [getBandwidthUsage])

  const isLoading = loading || websitesLoading

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Analytics | Ufazien Hosting</title>
          <meta name="description" content="Monitor your website traffic and performance" />
        </Helmet>
        <div className="min-h-screen bg-white">
          <HostingSidebar />
          <div className="lg:ml-64">
            <div className="p-4 lg:p-6 pt-16 lg:pt-6">
              <div className="animate-pulse space-y-6">
                <div className="h-8 bg-gray-300 rounded w-1/4"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-gray-300 rounded"></div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-64 bg-gray-300 rounded"></div>
                  <div className="h-64 bg-gray-300 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Helmet>
          <title>Analytics | Ufazien Hosting</title>
          <meta name="description" content="Monitor your website traffic and performance" />
        </Helmet>
        <div className="min-h-screen bg-white">
          <HostingSidebar />
          <div className="lg:ml-64">
            <div className="p-4 lg:p-6 pt-16 lg:pt-6">
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load analytics</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>Analytics | Ufazien Hosting</title>
        <meta name="description" content="Monitor your website traffic and performance" />
      </Helmet>
      <div className="min-h-screen bg-white">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-gray-100 rounded-lg p-2">
                  <BarChart3 className="h-6 w-6 text-gray-700" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
                  <p className="mt-2 text-gray-600">Monitor your website traffic and performance</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <Select
                    value={selectedWebsite?.id ? String(selectedWebsite.id) : ""}
                    onChange={(value) => {
                      const website = websites.find((w) => String(w.id) === value)
                      setSelectedWebsite(website ?? null)
                    }}
                    options={(websites ?? []).map((website) => ({
                      value: String(website.id),
                      label: website.name,
                    }))}
                    placeholder="Select a website"
                    aria-label="Website"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Period
                  </label>
                  <Select
        value={selectedPeriod}
        onChange={(value) => setSelectedPeriod(value)}
        options={[
          { value: "1d", label: "Last 24 hours" },
          { value: "7d", label: "Last 7 days" },
          { value: "30d", label: "Last 30 days" },
          { value: "90d", label: "Last 90 days" },
        ]}
      />
                </div>
              </div>
            </div>

            {websites && websites.length === 0 ? (
              <div className="text-center py-12">
                <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No websites found</h3>
                <p className="text-gray-600 mb-4">Create a website to view analytics</p>
                <button 
                  onClick={() => navigate('/hosting/websites/create')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Website
                </button>
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Visitors</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatNumber(summary?.total_unique_visitors ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Eye className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Page Views</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatNumber(summary?.total_page_views ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-yellow-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Bounce Rate</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {(summary?.avg_bounce_rate ?? 0).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Clock className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Avg. Session</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {Math.floor((summary?.avg_session_duration ?? 0) / 60)}m {Math.round((summary?.avg_session_duration ?? 0) % 60)}s
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts and Data */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Traffic Chart */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Traffic Overview</h3>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                          <span className="text-gray-600">Visitors</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-gray-600">Page Views</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trafficData}>
                          <defs>
                            <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorPageViews" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                          />
                          <YAxis 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            labelStyle={{ color: '#374151', fontWeight: 'medium' }}
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
                    </div>
                  </div>

                  {/* Top Pages */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h3>
                    <div className="space-y-3">
                      {/* The endpoint returns no per-page breakdown, so this
                          used to list four invented pages with invented view
                          counts. Saying nothing is better than saying that. */}
                      <p className="text-sm text-gray-500">
                        Per-page figures are not collected yet. Visits and page views
                        above are counted for the whole site.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bandwidth Usage */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Bandwidth Usage</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Current Period</span>
                        <span className="text-sm font-medium">
                          {bandwidthUsage.used} / {bandwidthUsage.limit}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${bandwidthUsage.percentage}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0</span>
                        <span>{bandwidthUsage.percentage}% used</span>
                        <span>{bandwidthUsage.limit}</span>
                      </div>
                      
                      {/* Mini bandwidth chart */}
                      <div className="mt-6">
                        <p className="text-sm font-medium text-gray-700 mb-2">Daily Usage (MB)</p>
                        <div className="h-20">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trafficData}>
                              <Line
                                type="monotone"
                                dataKey="bandwidth"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '6px',
                                  fontSize: '12px'
                                }}
                                labelFormatter={(label) => `Date: ${label}`}
                                formatter={(value) => [`${value} MB`, 'Bandwidth']}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Zap className="w-4 h-4 text-yellow-500 mr-2" />
                          <span className="text-sm text-gray-600">Avg. Load Time</span>
                        </div>
                        <span className="text-sm font-medium">1.2s</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Server className="w-4 h-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-600">Uptime</span>
                        </div>
                        <span className="text-sm font-medium text-green-600">99.9%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Activity className="w-4 h-4 text-blue-500 mr-2" />
                          <span className="text-sm text-gray-600">Status</span>
                        </div>
                        <span className="text-sm font-medium text-green-600">Healthy</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
