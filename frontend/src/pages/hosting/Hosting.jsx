"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Helmet } from "react-helmet"
import {
  Server,
  Plus,
  Globe,
  Database,
  Settings,
  Activity,
  BarChart3,
  Upload,
  Code,
  Zap,
  Menu,
  ExternalLink,
  Edit,
  Trash2,
  Play,
  Square,
  RefreshCw,
  GitBranch,
  Calendar,
  Clock,
  HardDrive,
  Cpu,
  MemoryStick,
  AlertCircle,
  CheckCircle,
  Eye,
  Copy,
  ChevronRight,
  FileText,
  Users,
  Shield,
  Crown
} from "lucide-react"
import HostingSidebar from "../../components/hosting/HostingSidebar"
import { useSubscription } from "../../hooks/useSubscription.jsx"
import { useWebsites } from "../../hooks/useWebsites"
import { useDatabases } from "../../hooks/useDatabases"
import { useDashboard } from "../../hooks/useDashboard"

const API_URL = import.meta.env.VITE_API_URL

export default function Hosting() {
  const navigate = useNavigate()
  const { subscription, getStorageUsage, getBandwidthUsage, loading: subLoading } = useSubscription()
  const { websites, loading: websitesLoading } = useWebsites()
  const { databases, loading: databasesLoading } = useDatabases()
  const { stats, loading: statsLoading, fetchActivityLog } = useDashboard()
  const [activeTab, setActiveTab] = useState("overview")
  const [recentActivity, setRecentActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)

  const loading = subLoading || websitesLoading || statsLoading

  // Load recent activity when stats are available
  useEffect(() => {
    if (stats?.recent_activity) {
      setRecentActivity(stats.recent_activity)
    }
  }, [stats])

  // Load additional activity if needed
  useEffect(() => {
    const loadRecentActivity = async () => {
      if (!activityLoading && (!stats?.recent_activity || stats.recent_activity.length === 0)) {
        try {
          setActivityLoading(true)
          const activityData = await fetchActivityLog({ limit: 5 })
          setRecentActivity(activityData.results || activityData || [])
        } catch (error) {
          console.error('Failed to load recent activity:', error)
        } finally {
          setActivityLoading(false)
        }
      }
    }

    loadRecentActivity()
  }, [stats, fetchActivityLog, activityLoading])

  // Quick Action handlers
  const navigateToCreateWebsite = () => {
    navigate('/hosting/websites/create')
  }

  const navigateToCreateDatabase = () => {
    navigate('/hosting/databases/create')
  }

  const navigateToAddDomain = () => {
    navigate('/hosting/domains')
  }

  // Activity icon mapping
  const getActivityIcon = (action) => {
    switch (action) {
      case 'website_created':
      case 'website_deployed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'website_deleted':
        return <Trash2 className="w-5 h-5 text-red-600" />
      case 'database_created':
        return <Database className="w-5 h-5 text-blue-600" />
      case 'database_deleted':
        return <Trash2 className="w-5 h-5 text-red-600" />
      case 'domain_added':
      case 'ssl_renewed':
        return <Shield className="w-5 h-5 text-green-600" />
      case 'backup_created':
        return <HardDrive className="w-5 h-5 text-purple-600" />
      default:
        return <Activity className="w-5 h-5 text-gray-600" />
    }
  }

  // Activity description mapping
  const getActivityDescription = (activity) => {
    const target = activity.target_name || activity.website_name || activity.database_name || 'Resource'
    
    switch (activity.action) {
      case 'website_created':
        return { title: 'Website created', subtitle: target }
      case 'website_deployed':
        return { title: 'Website deployed successfully', subtitle: target }
      case 'website_deleted':
        return { title: 'Website deleted', subtitle: target }
      case 'database_created':
        return { title: 'Database created', subtitle: target }
      case 'database_deleted':
        return { title: 'Database deleted', subtitle: target }
      case 'domain_added':
        return { title: 'Custom domain added', subtitle: target }
      case 'ssl_renewed':
        return { title: 'SSL certificate renewed', subtitle: target }
      case 'backup_created':
        return { title: 'Backup created', subtitle: target }
      default:
        return { title: activity.description || 'Activity recorded', subtitle: target }
    }
  }

  // Format relative time
  const getRelativeTime = (dateString) => {
    if (!dateString) return 'Unknown time'
    
    const now = new Date()
    const date = new Date(dateString)
    const diffInSeconds = Math.floor((now - date) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatStorage = (mb) => {
    if (!mb || mb === 0) return '0 MB'
    if (mb < 1024) return `${mb.toFixed(1)} MB`
    return `${(mb / 1024).toFixed(1)} GB`
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'building':
        return <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />
      case 'inactive':
        return <Square className="w-4 h-4 text-gray-400" />
      default:
        return <AlertCircle className="w-4 h-4 text-red-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'building':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-red-100 text-red-800 border-red-200'
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'static':
        return <FileText className="w-4 h-4 text-blue-600" />
      case 'php':
        return <Code className="w-4 h-4 text-purple-600" />
      default:
        return <Globe className="w-4 h-4 text-gray-600" />
    }
  }

  const handleCreateWebsite = (websiteData) => {
    // Handle website creation
    console.log('Creating website:', websiteData)
    // TODO: Make API call to create website
    // For now, just add to local state
    const newWebsite = {
      id: websites.length + 1,
      name: websiteData.name,
      domain: `${websiteData.subdomain}.ufazien.com`,
      status: "building",
      type: websiteData.type,
      lastDeployed: new Date().toISOString(),
      visits: 0,
      storage: 0,
      ssl: true,
      customDomain: websiteData.customDomain || null
    }
    setWebsites(prev => [...prev, newWebsite])
    setStats(prev => ({
      ...prev,
      totalWebsites: prev.totalWebsites + 1
    }))
  }

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Hosting Dashboard | Ufazien</title>
          <meta name="description" content="Manage your websites and hosting services on Ufazien" />
        </Helmet>
        <div className="min-h-screen bg-gray-50">
          <HostingSidebar />
          <div className="ml-64">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>Hosting Dashboard | Ufazien</title>
        <meta name="description" content="Manage your websites and hosting services on Ufazien" />
      </Helmet>
      <div className="min-h-screen bg-gray-50">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          {/* Main Content */}
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">{/* Added top padding for mobile menu button */}
            {/* Header */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Hosting Dashboard</h1>
                  <p className="mt-2 text-gray-600">Manage your websites and hosting services</p>
                </div>
                <div className="mt-4 sm:mt-0">
                  <button 
                    onClick={() => navigate('/hosting/websites/create')}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Website
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Server className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Websites</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.total_websites || websites.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Activity className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Sites</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.active_websites || websites.filter(w => w.status === 'active').length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Eye className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Visits</p>
                    <p className="text-2xl font-bold text-gray-900">{(stats?.total_visits || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <HardDrive className="w-8 h-8 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Storage Used</p>
                    <p className="text-2xl font-bold text-gray-900">{getStorageUsage().used}</p>
                    <p className="text-xs text-gray-500">of {getStorageUsage().limit}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Overview */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 mb-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Current Plan: {subscription?.plan?.display_name || 'Free'}</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
                    <div>
                      <p className="text-blue-100 text-sm">Websites</p>
                      <p className="text-xl font-bold">{websites.length} / {subscription?.plan?.max_websites || 5}</p>
                    </div>
                    <div>
                      <p className="text-blue-100 text-sm">Databases</p>
                      <p className="text-xl font-bold">{databases?.length || 0} / {subscription?.plan?.max_databases || 5}</p>
                    </div>
                    <div>
                      <p className="text-blue-100 text-sm">Storage</p>
                      <p className="text-xl font-bold">{getStorageUsage().used} / {getStorageUsage().limit}</p>
                    </div>
                    <div>
                      <p className="text-blue-100 text-sm">Price</p>
                      <p className="text-xl font-bold">${subscription?.plan?.price || 0}/mo</p>
                    </div>
                  </div>
                </div>
                {subscription?.plan?.name === 'free' && (
                  <div className="text-right">
                    <button
                      onClick={() => navigate('/hosting/upgrade')}
                      className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                    >
                      Upgrade Plan
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-6 sm:gap-8 overflow-x-auto whitespace-nowrap">
                  {[
                    { id: 'overview', name: 'Overview', icon: BarChart3 },
                    { id: 'websites', name: 'Websites', icon: Globe },
                    { id: 'databases', name: 'Databases', icon: Database },
                    { id: 'analytics', name: 'Analytics', icon: Activity },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <tab.icon className={`mr-2 w-4 h-4 ${
                        activeTab === tab.id ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
                      }`} />
                      {tab.name}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Quick Actions */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button 
                      onClick={navigateToCreateWebsite}
                      className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="w-6 h-6 text-blue-600 mr-3" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">New Static Site</p>
                        <p className="text-sm text-gray-600">HTML, CSS, JS</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={navigateToCreateWebsite}
                      className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Code className="w-6 h-6 text-purple-600 mr-3" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">New PHP Site</p>
                        <p className="text-sm text-gray-600">Dynamic website</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={navigateToCreateDatabase}
                      className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Database className="w-6 h-6 text-green-600 mr-3" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">New Database</p>
                        <p className="text-sm text-gray-600">MySQL or PostgreSQL</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={navigateToAddDomain}
                      className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Globe className="w-6 h-6 text-indigo-600 mr-3" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">Custom Domain</p>
                        <p className="text-sm text-gray-600">Connect your domain</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-4">
                    {activityLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse flex items-center space-x-3">
                            <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                            <div className="flex-1">
                              <div className="w-48 h-4 bg-gray-300 rounded mb-1"></div>
                              <div className="w-32 h-3 bg-gray-300 rounded"></div>
                            </div>
                            <div className="w-16 h-3 bg-gray-300 rounded"></div>
                          </div>
                        ))}
                      </div>
                    ) : recentActivity && recentActivity.length > 0 ? (
                      recentActivity.slice(0, 5).map((activity, index) => {
                        const { title, subtitle } = getActivityDescription(activity)
                        return (
                          <div key={activity.id || index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                            <div className="flex items-center">
                              {getActivityIcon(activity.action)}
                              <div className="ml-3">
                                <p className="font-medium text-gray-900">{title}</p>
                                <p className="text-sm text-gray-600">{subtitle}</p>
                              </div>
                            </div>
                            <span className="text-sm text-gray-500">
                              {getRelativeTime(activity.created_at || activity.timestamp)}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-8">
                        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">No recent activity</p>
                        <p className="text-sm text-gray-500">Your hosting activity will appear here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'websites' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Your Websites</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {websitesLoading ? (
                      <div className="p-6">
                        <div className="animate-pulse">
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-gray-300 rounded"></div>
                            <div className="space-y-2">
                              <div className="w-32 h-4 bg-gray-300 rounded"></div>
                              <div className="w-48 h-3 bg-gray-300 rounded"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : websites.length > 0 ? (
                      websites.map((website) => (
                      <div key={website.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              {getTypeIcon(website.website_type)}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="text-lg font-medium text-gray-900">{website.name}</h4>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(website.status)}`}>
                                  {getStatusIcon(website.status)}
                                  <span className="ml-1 capitalize">{website.status}</span>
                                </span>
                              </div>
                              <div className="flex items-center space-x-4 mt-1">
                                <span className="text-sm text-gray-600 flex items-center">
                                  <Globe className="w-4 h-4 mr-1" />
                                  {website.domain?.domain_name || website.url || 'No domain'}
                                </span>
                                {website.domain && website.domain.domain_type === 'custom' && (
                                  <span className="text-sm text-blue-600 flex items-center">
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    Custom Domain
                                  </span>
                                )}
                                {website.domain?.ssl_enabled && (
                                  <span className="text-sm text-green-600 flex items-center">
                                    <Shield className="w-4 h-4 mr-1" />
                                    SSL
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                <span className="flex items-center">
                                  <Clock className="w-4 h-4 mr-1" />
                                  {formatDate(website.last_deployment)}
                                </span>
                                <span className="flex items-center">
                                  <Eye className="w-4 h-4 mr-1" />
                                  {(website.total_visits || 0).toLocaleString()} visits
                                </span>
                                <span className="flex items-center">
                                  <HardDrive className="w-4 h-4 mr-1" />
                                  {formatStorage(website.storage_used_mb)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => {
                                const url = website.url || (website.domain?.domain_name ? `https://${website.domain.domain_name}` : null)
                                if (url) window.open(url, '_blank')
                              }}
                              disabled={!website.url && !website.domain?.domain_name}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => navigate(`/hosting/website/${website.id}`)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => navigate(`/hosting/website/${website.id}?tab=settings`)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                    ) : (
                      <div className="text-center py-12">
                        <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No websites found</h3>
                        <p className="text-gray-600 mb-6">Get started by creating your first website</p>
                        <button 
                          onClick={() => navigate('/hosting/websites/create')}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Website
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'databases' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Database Management</h3>
                    <button 
                      onClick={() => navigate('/hosting/databases/create')}
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New Database
                    </button>
                  </div>
                  
                  {databasesLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[1, 2].map((i) => (
                        <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="w-6 h-6 bg-gray-300 rounded"></div>
                            <div className="space-y-2">
                              <div className="w-24 h-4 bg-gray-300 rounded"></div>
                              <div className="w-16 h-3 bg-gray-300 rounded"></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="w-full h-3 bg-gray-300 rounded"></div>
                            <div className="w-full h-3 bg-gray-300 rounded"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : databases.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {databases.map((database) => (
                        <div key={database.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <Database className={`w-6 h-6 mr-3 ${database.db_type === 'postgresql' ? 'text-indigo-600' : 'text-blue-600'}`} />
                              <div>
                                <h4 className="font-medium text-gray-900">{database.name}</h4>
                                <p className="text-sm text-gray-600 capitalize">
                                  {database.db_type === 'mysql' ? 'MySQL' : 'PostgreSQL'}
                                </p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(database.status)}`}>
                              {getStatusIcon(database.status)}
                              <span className="ml-1 capitalize">{database.status}</span>
                            </span>
                          </div>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex justify-between">
                              <span>Storage:</span>
                              <span>{formatStorage(database.size_mb)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Host:</span>
                              <span className="font-mono text-xs">{database.host}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Created:</span>
                              <span>{formatDate(database.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex space-x-2 mt-4">
                            <button 
                              onClick={() => navigate('/hosting/databases')}
                              className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              Manage
                            </button>
                            <button className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors">
                              Backup
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No databases found</h3>
                      <p className="text-gray-600 mb-6">Get started by creating your first database</p>
                      <button 
                        onClick={() => navigate('/hosting/databases/create')}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Database
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Website Analytics</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-4">Traffic Overview</h4>
                      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                        <div className="text-center">
                          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-600">Analytics chart will be displayed here</p>
                        </div>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-4">Performance Metrics</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium text-gray-700">Average Load Time</span>
                          <span className="text-sm text-green-600 font-semibold">1.2s</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium text-gray-700">Uptime</span>
                          <span className="text-sm text-green-600 font-semibold">99.9%</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium text-gray-700">SSL Score</span>
                          <span className="text-sm text-green-600 font-semibold">A+</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium text-gray-700">Security Score</span>
                          <span className="text-sm text-green-600 font-semibold">95/100</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
