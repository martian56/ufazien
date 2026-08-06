import { useState, useEffect } from "react"
import { downloadCsv, toCsv } from "../../lib/csv"
import { Helmet } from "react-helmet"
import {
  FileText,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Database,
  Server,
  Shield
} from "lucide-react"
import HostingSidebar from "../../components/hosting/HostingSidebar"
import { useLogs } from "../../hooks/useLogs"

export default function Logs() {
  const { loading, error, logs, refreshLogs, loadMoreActivity, pagination } = useLogs()
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [levelFilter, setLevelFilter] = useState("all")
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const handleRefresh = () => {
    refreshLogs()
    setLastRefresh(new Date())
  }

  const handleExport = () => {
    // Was built by hand here: fields were wrapped in quotes but the quotes
    // inside them were never doubled, so one quotation mark in a log message
    // broke its row.
    const csv = toCsv(
      filteredLogs.map((log) => ({
        timestamp: new Date(log.timestamp).toLocaleString(),
        level: log.level,
        type: log.type,
        source: log.source,
        message: log.message,
        details: log.details,
      })),
      [
        { key: "timestamp", header: "Timestamp" },
        { key: "level", header: "Level" },
        { key: "type", header: "Type" },
        { key: "source", header: "Source" },
        { key: "message", header: "Message" },
        { key: "details", header: "Details" },
      ]
    )
    downloadCsv(csv, `hosting-logs-${new Date().toISOString().split("T")[0]}.csv`)
  }


  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'info':
        return 'bg-green-50 border-green-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'website':
        return <Globe className="h-4 w-4 text-blue-600" />
      case 'database':
        return <Database className="h-4 w-4 text-green-600" />
      case 'ssl':
        return <Shield className="h-4 w-4 text-purple-600" />
      case 'system':
        return <Server className="h-4 w-4 text-gray-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp)
    const diffInMinutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`
    
    return date.toLocaleString()
  }

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refreshLogs()
      setLastRefresh(new Date())
    }, 30000)

    return () => clearInterval(interval)
  }, [refreshLogs, autoRefresh])

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.source.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === "all" || log.type === typeFilter
    const matchesLevel = levelFilter === "all" || log.level === levelFilter
    return matchesSearch && matchesType && matchesLevel
  })

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Logs | Ufazien Hosting</title>
          <meta name="description" content="View system and application logs" />
        </Helmet>
        <div className="min-h-screen bg-gray-50">
          <HostingSidebar />
          <div className="ml-64">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading logs...</p>
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
          <title>Logs | Ufazien Hosting</title>
          <meta name="description" content="View system and application logs" />
        </Helmet>
        <div className="min-h-screen bg-gray-50">
          <HostingSidebar />
          <div className="ml-64">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Logs</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
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
        <title>Logs | Ufazien Hosting</title>
        <meta name="description" content="View system and application logs" />
      </Helmet>
      <div className="min-h-screen bg-gray-50">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">{/* Added top padding for mobile menu button */}
            {/* Header */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-blue-100 rounded-lg p-2">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900">Logs</h1>
                      <p className="mt-2 text-gray-600">View system and application logs</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 sm:mt-0 flex flex-wrap items-center gap-2">
                  <button 
                    onClick={handleRefresh}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <button 
                    onClick={handleExport}
                    disabled={loading || filteredLogs.length === 0}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </button>
                  <div className="flex items-center space-x-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700">Auto-refresh</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1"
                >
                  <option value="all">All Types</option>
                  <option value="website">Website</option>
                  <option value="database">Database</option>
                  <option value="ssl">SSL</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-gray-400" />
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1"
                >
                  <option value="all">All Levels</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  Last updated: {formatTimestamp(lastRefresh)}
                  {autoRefresh && <span className="text-green-600 ml-1">• Live</span>}
                </span>
              </div>
            </div>

            {/* Logs List */}
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`border rounded-lg p-4 ${getLevelColor(log.level)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex items-center space-x-2 mt-1">
                        {getLevelIcon(log.level)}
                        {getTypeIcon(log.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">{log.source}</span>
                          <span className="text-xs px-2 py-1 bg-gray-200 rounded-full text-gray-600 capitalize">
                            {log.type}
                          </span>
                          {String((log.original as { id?: string })?.id ?? '').includes('deployment') && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full">
                              Deployment
                            </span>
                          )}
                        </div>
                        <p className="text-gray-800 mb-1">{log.message}</p>
                        {log.details && (
                          <p className="text-sm text-gray-600">{log.details}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 ml-4">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredLogs.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No logs found</h3>
                <p className="text-gray-600">
                  {searchTerm || typeFilter !== "all" || levelFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "No logs available at the moment"
                  }
                </p>
                {!searchTerm && typeFilter === "all" && levelFilter === "all" && (
                  <button
                    onClick={handleRefresh}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Logs
                  </button>
                )}
              </div>
            )}

            {/* Load More Button */}
            {filteredLogs.length > 0 && pagination?.activity?.next && (
              <div className="text-center mt-8">
                <button
                  onClick={async () => {
                    setLoadingMore(true)
                    try {
                      await loadMoreActivity()
                    } finally {
                      setLoadingMore(false)
                    }
                  }}
                  disabled={loading || loadingMore}
                  className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? 'Loading...' : 'Load More Logs'}
                </button>
              </div>
            )}

            {/* Log Statistics */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="text-sm text-gray-500">Info</div>
                    <div className="text-lg font-semibold">{logs.filter(l => l.level === 'info').length}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <div className="text-sm text-gray-500">Warnings</div>
                    <div className="text-lg font-semibold">{logs.filter(l => l.level === 'warning').length}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <div className="text-sm text-gray-500">Errors</div>
                    <div className="text-lg font-semibold">{logs.filter(l => l.level === 'error').length}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="text-sm text-gray-500">Total</div>
                    <div className="text-lg font-semibold">{logs.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
