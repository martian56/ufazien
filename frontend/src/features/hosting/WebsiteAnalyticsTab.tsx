import { Clock, Eye, TrendingUp, Users } from "lucide-react"
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

interface WebsiteAnalyticsTabProps {
  website: Website
  analytics: Record<string, unknown> | null
}

/**
 * Traffic and bandwidth for one website.
 *
 * Carved out of WebsiteDetail, which held all five tabs inline in one
 * 1,300-line function.
 */
export default function WebsiteAnalyticsTab({ website, analytics }: WebsiteAnalyticsTabProps) {
  return (
        <div className="space-y-6">
          {/* Analytics Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Unique Visitors</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.floor(Math.random() * 2000) + 500}
                  </p>
                  <p className="text-xs text-green-600">+12% this week</p>
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
                    {Math.floor(Math.random() * 8000) + 2000}
                  </p>
                  <p className="text-xs text-green-600">+8% this week</p>
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
                    {(Math.random() * 30 + 25).toFixed(1)}%
                  </p>
                  <p className="text-xs text-red-600">+2% this week</p>
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
                    {Math.floor(Math.random() * 3 + 2)}m {Math.floor(Math.random() * 60)}s
                  </p>
                  <p className="text-xs text-green-600">+15% this week</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Traffic Trend Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Traffic Trend (Last 7 Days)</h3>
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
                  <AreaChart data={(() => {
                    const data = []
                    const today = new Date()
                    
                    for (let i = 6; i >= 0; i--) {
                      const date = new Date(today)
                      date.setDate(date.getDate() - i)
                      
                      const visitors = Math.floor(Math.random() * 300) + 100
                      const pageViews = visitors + Math.floor(Math.random() * 500) + 200
                      
                      data.push({
                        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        visitors,
                        pageViews
                      })
                    }
                    return data
                  })()}>
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
              <div className="space-y-4">
                {[
                  { page: '/', views: Math.floor(Math.random() * 1000) + 500, change: '+12%' },
                  { page: '/about', views: Math.floor(Math.random() * 500) + 200, change: '+8%' },
                  { page: '/contact', views: Math.floor(Math.random() * 300) + 100, change: '+5%' },
                  { page: '/services', views: Math.floor(Math.random() * 400) + 150, change: '+15%' },
                  { page: '/blog', views: Math.floor(Math.random() * 600) + 300, change: '+3%' }
                ].map((page, index) => (
                  <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">{page.page}</span>
                        <p className="text-xs text-gray-500">{page.views} views</p>
                      </div>
                    </div>
                    <span className="text-xs text-green-600 font-medium">{page.change}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Row - Referrers and Device Types */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Traffic Sources */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Traffic Sources</h3>
              <div className="space-y-3">
                {[
                  { source: 'Direct', visits: Math.floor(Math.random() * 500) + 200, percentage: '45%', color: 'bg-blue-500' },
                  { source: 'Google', visits: Math.floor(Math.random() * 300) + 150, percentage: '30%', color: 'bg-green-500' },
                  { source: 'Social Media', visits: Math.floor(Math.random() * 200) + 100, percentage: '15%', color: 'bg-purple-500' },
                  { source: 'Referrals', visits: Math.floor(Math.random() * 150) + 50, percentage: '10%', color: 'bg-yellow-500' }
                ].map((referrer, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 ${referrer.color} rounded-full mr-3`}></div>
                      <span className="text-sm font-medium text-gray-900">{referrer.source}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900">{referrer.visits}</span>
                      <span className="text-xs text-gray-500 ml-2">{referrer.percentage}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Device Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Types</h3>
              <div className="space-y-4">
                {[
                  { device: 'Desktop', percentage: 55, count: Math.floor(Math.random() * 800) + 400 },
                  { device: 'Mobile', percentage: 35, count: Math.floor(Math.random() * 600) + 300 },
                  { device: 'Tablet', percentage: 10, count: Math.floor(Math.random() * 200) + 100 }
                ].map((device, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{device.device}</span>
                      <span className="text-sm text-gray-600">{device.count} ({device.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${device.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Real-time Activity */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Real-time Activity</h3>
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span>{Math.floor(Math.random() * 10) + 5} users online</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{Math.floor(Math.random() * 50) + 20}</p>
                <p className="text-sm text-gray-600">Active Users</p>
              </div>
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{Math.floor(Math.random() * 30) + 10}</p>
                <p className="text-sm text-gray-600">Pages/Session</p>
              </div>
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{Math.floor(Math.random() * 5) + 2}m</p>
                <p className="text-sm text-gray-600">Avg. Duration</p>
              </div>
            </div>
          </div>
        </div>
  )
}
