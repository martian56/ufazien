import { useState, useEffect, useMemo } from "react"
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
  const [selectedWebsite, setSelectedWebsite] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState('7d')
  const [analyticsData, setAnalyticsData] = useState(null)
  const [bandwidthData, setBandwidthData] = useState(null)
  const [error, setError] = useState(null)

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
        setError(err.message)
        console.error('Failed to load analytics:', err)
      } finally {
        setLoading(false)
      }
    }

    if (!websitesLoading && selectedWebsite) {
      loadAnalytics()
    } else if (!websitesLoading) {
      setLoading(false)
    }
  }, [selectedWebsite?.id, selectedPeriod, websitesLoading])

  // Auto-select first website when websites load
  useEffect(() => {
    if (!websitesLoading && !selectedWebsite && websites && websites.length > 0) {
      setSelectedWebsite(websites[0])
    }
  }, [websites, websitesLoading, selectedWebsite])

  // Format numbers for display
  const formatNumber = (num) => {
    if (!num) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  // Format bytes
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  // Get mock data for demonstration (until real analytics data is available)
  const mockData = useMemo(() => {
    // Generate traffic data for the last 7 days
    const generateTrafficData = () => {
      const data = []
      const today = new Date()
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        
        const baseVisitors = Math.floor(Math.random() * 500) + 200
        const basePageViews = baseVisitors + Math.floor(Math.random() * 800) + 300
        
        data.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: date.toISOString().split('T')[0],
          visitors: baseVisitors,
          pageViews: basePageViews,
          sessions: Math.floor(baseVisitors * (0.7 + Math.random() * 0.3)),
          bounceRate: (Math.random() * 40 + 20).toFixed(1),
          bandwidth: Math.floor(Math.random() * 100) + 50 // MB per day
        })
      }
      return data
    }

    return {
      visitors: Math.floor(Math.random() * 10000) + 1000,
      pageViews: Math.floor(Math.random() * 50000) + 5000,
      bounceRate: (Math.random() * 40 + 20).toFixed(1), // 20-60%
      avgSessionDuration: Math.floor(Math.random() * 300 + 60), // 1-5 minutes
      topPages: [
        { page: '/', views: Math.floor(Math.random() * 1000) + 500 },
        { page: '/about', views: Math.floor(Math.random() * 500) + 200 },
        { page: '/contact', views: Math.floor(Math.random() * 300) + 100 },
        { page: '/blog', views: Math.floor(Math.random() * 800) + 300 },
      ],
      trafficData: generateTrafficData()
    }
  }, [selectedWebsite?.id]) // Regenerate when website changes

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
        <div className="min-h-screen bg-gray-50">
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
        <div className="min-h-screen bg-gray-50">
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
      <div className="min-h-screen bg-gray-50">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-100 rounded-lg p-2">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
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
                  <select
                    value={selectedWebsite?.id || ''}
                    onChange={(e) => {
                      const website = websites.find(w => w.id === e.target.value)
                      setSelectedWebsite(website)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {websites && websites.length > 0 ? (
                      websites.map(website => (
                        <option key={website.id} value={website.id}>
                          {website.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No websites available</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Period
                  </label>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="1d">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
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
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Visitors</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatNumber(analyticsData?.visitors || mockData.visitors)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Eye className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Page Views</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatNumber(analyticsData?.pageViews || mockData.pageViews)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-yellow-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Bounce Rate</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {analyticsData?.bounceRate || mockData.bounceRate}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Clock className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Avg. Session</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {Math.floor((analyticsData?.avgSessionDuration || mockData.avgSessionDuration) / 60)}m {(analyticsData?.avgSessionDuration || mockData.avgSessionDuration) % 60}s
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts and Data */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Traffic Chart */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                        <AreaChart data={mockData.trafficData}>
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
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h3>
                    <div className="space-y-3">
                      {(analyticsData?.topPages || mockData.topPages).map((page, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                              <span className="text-sm font-medium text-gray-600">{index + 1}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{page.page}</span>
                          </div>
                          <span className="text-sm text-gray-600">{formatNumber(page.views)} views</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bandwidth Usage */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                            <LineChart data={mockData.trafficData}>
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

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
