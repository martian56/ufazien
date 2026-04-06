import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Helmet } from "react-helmet"
import {
  ArrowLeft,
  ExternalLink,
  Settings,
  Activity,
  Database,
  FileText,
  Folder,
  Globe,
  Shield,
  Upload,
  Download,
  RefreshCw,
  Trash2,
  Edit,
  Copy,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  HardDrive,
  Zap,
  Menu,
  Play,
  Square,
  BarChart3,
  Code,
  Terminal,
  Users,
  TrendingUp
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
  Area,
  BarChart,
  Bar
} from 'recharts'
import HostingSidebar from "../../components/hosting/HostingSidebar"
import ConfirmationModal from "../../components/ui/ConfirmationModal"
import { hostingApi } from "../../utils/hostingApi.js"
import { useWebsites } from "../../hooks/useWebsites.js"

export default function WebsiteDetail() {
  const { websiteId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [website, setWebsite] = useState(null)
  const [deployments, setDeployments] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [error, setError] = useState(null)
  const [editingSettings, setEditingSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: ""
  })
  const [envVars, setEnvVars] = useState([])
  const [editingEnvVars, setEditingEnvVars] = useState(false)
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, loading: false })
  const { deployWebsite, deleteWebsite } = useWebsites()

  // Fetch website data
  useEffect(() => {
    const fetchWebsiteData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch website details
        const websiteData = await hostingApi.getWebsite(websiteId)
        setWebsite(websiteData)
        
        // Initialize settings form
        setSettingsForm({
          name: websiteData.name || "",
          description: websiteData.description || ""
        })

        // Initialize environment variables
        const envVarArray = Object.entries(websiteData.environment_variables || {}).map(([key, value]) => ({
          id: Math.random().toString(36).substr(2, 9),
          key,
          value
        }))
        setEnvVars(envVarArray)

        // Fetch deployments
        const deploymentsData = await hostingApi.getWebsiteDeployments(websiteId)
        setDeployments(deploymentsData.results || deploymentsData || [])

        // Fetch analytics (with fallback for errors)
        try {
          const analyticsData = await hostingApi.getWebsiteAnalytics(websiteId)
          setAnalytics(analyticsData)
        } catch (analyticsError) {
          console.warn('Analytics not available:', analyticsError)
          // Set default analytics data
          setAnalytics({
            dailyVisits: [0, 0, 0, 0, 0, 0, 0],
            topPages: [],
            referrers: []
          })
        }

      } catch (err) {
        console.error('Failed to fetch website data:', err)
        setError(err.message || 'Failed to load website data')
      } finally {
        setLoading(false)
      }
    }

    if (websiteId) {
      fetchWebsiteData()
    }
  }, [websiteId])

  // File manager helpers
  const refreshFiles = async () => {
    try {
      const res = await hostingApi.listFiles(websiteId)
      setFiles(res.files || [])
      setFolders(res.folders || [])
    } catch (err) {
      console.error('Failed to list files:', err)
      setFiles([])
      setFolders([])
    }
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return
    setUploading(true)
    try {
      const fd = new FormData()
      selectedFiles.forEach(f => {
        // Use relativePath if available (folder upload), otherwise use regular name
        const fileName = f.relativePath || f.name
        console.log(`Uploading file: ${f.name} as ${fileName}`)
        
        // Create a new File object with the correct name
        const fileToUpload = new File([f], fileName, { type: f.type })
        fd.append('files', fileToUpload)
      })
      await hostingApi.uploadFiles(websiteId, fd)
      setSelectedFiles([])
      await refreshFiles()
    } catch (err) {
      alert('Upload failed: ' + (err.message || err))
    } finally {
      setUploading(false)
    }
  }

  const handleFileDelete = async (filename) => {
    if (!confirm(`Delete ${filename}?`)) return
    try {
      await hostingApi.deleteFile(websiteId, filename)
      await refreshFiles()
    } catch (err) {
      alert('Delete failed: ' + (err.message || err))
    }
  }

  const handleDownload = async (filename) => {
    try {
      // Use the authenticated API to download the file
      const response = await hostingApi.downloadFile(websiteId, filename)
      
      // Get the blob from the response
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Download failed: ' + (err.message || err))
    }
  }

  useEffect(() => {
    if (activeTab === 'files') {
      refreshFiles()
    }
  }, [activeTab, websiteId])

  const handleDeploy = async () => {
    try {
      await deployWebsite(websiteId)
      // Refresh deployments after deploy
      const deploymentsData = await hostingApi.getWebsiteDeployments(websiteId)
      setDeployments(deploymentsData.results || deploymentsData || [])
    } catch (err) {
      alert('Failed to deploy website: ' + err.message)
    }
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this website? This action cannot be undone.')) {
      try {
        await deleteWebsite(websiteId)
        navigate('/hosting/websites')
      } catch (err) {
        alert('Failed to delete website: ' + err.message)
      }
    }
  }

  const openDeleteModal = () => {
    setDeleteModal({ isOpen: true, loading: false })
  }

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, loading: false })
  }

  const confirmDeleteWebsite = async () => {
    setDeleteModal(prev => ({ ...prev, loading: true }))
    
    try {
      await deleteWebsite(websiteId)
      navigate('/hosting/websites')
    } catch (err) {
      alert('Failed to delete website: ' + err.message)
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  const handleSettingsChange = (field, value) => {
    setSettingsForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveSettings = async () => {
    try {
      const updatedWebsite = await hostingApi.updateWebsite(websiteId, settingsForm)
      setWebsite(updatedWebsite)
      setEditingSettings(false)
      // Show success message (could add toast notification here)
    } catch (err) {
      alert('Failed to update website settings: ' + err.message)
    }
  }

  const handleCancelSettings = () => {
    setSettingsForm({
      name: website.name || "",
      description: website.description || ""
    })
    setEditingSettings(false)
  }

  // Environment Variables handlers
  const handleAddEnvVar = () => {
    setEnvVars(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      key: '',
      value: ''
    }])
  }

  const handleEnvVarChange = (id, field, value) => {
    setEnvVars(prev => prev.map(envVar => 
      envVar.id === id ? { ...envVar, [field]: value } : envVar
    ))
  }

  const handleRemoveEnvVar = (id) => {
    setEnvVars(prev => prev.filter(envVar => envVar.id !== id))
  }

  const handleSaveEnvVars = async () => {
    try {
      // Convert array back to object format for API
      const envVarObject = {}
      envVars.forEach(envVar => {
        if (envVar.key.trim()) {
          envVarObject[envVar.key.trim()] = envVar.value
        }
      })

      const updatedWebsite = await hostingApi.updateWebsite(websiteId, {
        environment_variables: envVarObject
      })
      setWebsite(updatedWebsite)
      setEditingEnvVars(false)
      // Show success message (could add toast notification here)
    } catch (err) {
      alert('Failed to update environment variables: ' + err.message)
    }
  }

  const handleCancelEnvVars = () => {
    // Reset to original env vars
    const envVarArray = Object.entries(website?.environment_variables || {}).map(([key, value]) => ({
      id: Math.random().toString(36).substr(2, 9),
      key,
      value
    }))
    setEnvVars(envVarArray)
    setEditingEnvVars(false)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatStorage = (mb) => {
    const storage = mb || 0
    if (storage < 1024) return `${storage.toFixed(1)} MB`
    return `${(storage / 1024).toFixed(1)} GB`
  }

  const getWebsiteUrl = () => {
    if (website?.domain?.name) {
      return website.domain.name
    }
    // Generate subdomain URL as fallback
    return `${website?.name?.toLowerCase().replace(/\s+/g, '-')}.ufazien.com`
  }

  const getSSLStatus = () => {
    // Check if website has SSL enabled through domain
    return website?.domain?.ssl_enabled || false
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'building':
        return <RefreshCw className="w-5 h-5 text-yellow-600 animate-spin" />
      case 'inactive':
        return <Square className="w-5 h-5 text-gray-400" />
      default:
        return <AlertCircle className="w-5 h-5 text-red-600" />
    }
  }

  const getLogIcon = (status) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'error':
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'building':
      case 'queued':
        return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    // Could add toast notification here
  }

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Website Details | Ufazien Hosting</title>
        </Helmet>
        <div className="min-h-screen bg-gray-50">
          <HostingSidebar />
          <div className="lg:ml-64">
            <div className="flex items-center justify-center h-64 pt-16 lg:pt-0">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (error || !website) {
    return (
      <>
        <Helmet>
          <title>Website Not Found | Ufazien Hosting</title>
        </Helmet>
        <div className="min-h-screen bg-gray-50">
          <HostingSidebar />
          <div className="lg:ml-64">
            <div className="flex items-center justify-center h-64 pt-16 lg:pt-0">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {error ? 'Error Loading Website' : 'Website Not Found'}
                </h2>
                <p className="text-gray-600 mb-4">
                  {error || "The website you're looking for doesn't exist."}
                </p>
                <button
                  onClick={() => navigate('/hosting/websites')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Back to Websites
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
        <title>{website.name} | Ufazien Hosting</title>
        <meta name="description" content={`Manage ${website.name} - ${website.domain}`} />
      </Helmet>
      <div className="min-h-screen bg-gray-50">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          {/* Main Content */}
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">{/* Added top padding for mobile menu button */}
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <button
                  onClick={() => navigate('/hosting/websites')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors mr-3"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h1 className="text-3xl font-bold text-gray-900">{website.name}</h1>
                    {getStatusIcon(website.status)}
                    <span className="text-sm text-gray-600 capitalize">{website.status}</span>
                  </div>
                  <div className="flex items-center space-x-4 mt-2">
                    <button
                      onClick={() => copyToClipboard(`https://${getWebsiteUrl()}`)}
                      className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Globe className="w-4 h-4 mr-1" />
                      {getWebsiteUrl()}
                      <Copy className="w-3 h-3 ml-1" />
                    </button>
                    {getSSLStatus() && (
                      <span className="flex items-center text-green-600 text-sm">
                        <Shield className="w-4 h-4 mr-1" />
                        SSL Enabled
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <a 
                    href={`https://${getWebsiteUrl()}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-5 h-5 text-gray-600" />
                  </a>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <RefreshCw className="w-5 h-5 text-gray-600" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Settings className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <Eye className="w-6 h-6 text-blue-600 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Total Visits</p>
                      <p className="text-lg font-semibold text-gray-900">{(website.total_visits || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <HardDrive className="w-6 h-6 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Storage Used</p>
                      <p className="text-lg font-semibold text-gray-900">{formatStorage(website.storage_used_mb)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <Clock className="w-6 h-6 text-purple-600 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Last Deploy</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {website.last_deployment ? formatDate(website.last_deployment) : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <Zap className="w-6 h-6 text-yellow-600 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Uptime</p>
                      <p className="text-lg font-semibold text-gray-900">99.9%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'overview', name: 'Overview', icon: Activity },
                    { id: 'deployments', name: 'Deployments', icon: Upload },
                    { id: 'files', name: 'File Manager', icon: FileText },
                    { id: 'analytics', name: 'Analytics', icon: BarChart3 },
                    { id: 'settings', name: 'Settings', icon: Settings },
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Deployment Status */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Deployment Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Status</span>
                      <div className="flex items-center">
                        {getStatusIcon(website.status)}
                        <span className="ml-2 text-sm capitalize">{website.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Type</span>
                      <span className="text-sm text-gray-600 capitalize">{website.website_type || 'static'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Last Deployment</span>
                      <span className="text-sm text-gray-600">
                        {website.last_deployment ? formatDate(website.last_deployment) : 'Never'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">SSL Certificate</span>
                      <span className={`text-sm ${getSSLStatus() ? 'text-green-600' : 'text-red-600'}`}>
                        {getSSLStatus() ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex space-x-3">
                    <button 
                      onClick={handleDeploy}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Deploy Now
                    </button>
                    <button 
                      onClick={() => setActiveTab('deployments')}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      View Logs
                    </button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-4">
                    {deployments.slice(0, 4).map((deployment) => (
                      <div key={deployment.id} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getLogIcon(deployment.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            {deployment.commit_message || `Deployment ${deployment.status}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {deployment.started_at ? formatDate(deployment.started_at) : 'Unknown time'}
                          </p>
                        </div>
                        {deployment.deploy_time_seconds && (
                          <span className="text-xs text-gray-500">{deployment.deploy_time_seconds}s</span>
                        )}
                      </div>
                    ))}
                    {deployments.length === 0 && (
                      <p className="text-sm text-gray-500">No deployment history available</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'deployments' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Deployment History</h3>
                  <button 
                    onClick={handleDeploy}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    New Deployment
                  </button>
                </div>
                <div className="divide-y divide-gray-200">
                  {deployments.map((deployment) => (
                    <div key={deployment.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getLogIcon(deployment.status)}
                          <div>
                            <p className="font-medium text-gray-900">
                              {deployment.commit_message || `Deployment ${deployment.status}`}
                            </p>
                            <p className="text-sm text-gray-600">
                              {deployment.started_at ? formatDate(deployment.started_at) : 'Unknown time'}
                            </p>
                            {deployment.commit_hash && (
                              <p className="text-xs text-gray-500">
                                Commit: {deployment.commit_hash.substring(0, 8)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {deployment.deploy_time_seconds && (
                            <span className="text-sm text-gray-500">{deployment.deploy_time_seconds}s</span>
                          )}
                          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {deployment.error_message && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-700">{deployment.error_message}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {deployments.length === 0 && (
                    <div className="p-6 text-center">
                      <p className="text-gray-500">No deployments yet</p>
                      <button 
                        onClick={handleDeploy}
                        className="mt-2 text-blue-600 hover:text-blue-700"
                      >
                        Create your first deployment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">File Manager</h3>
                  <div className="flex space-x-2">
                            <label className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer inline-flex items-center">
                              <Upload className="w-4 h-4 mr-2 inline" />
                              <input type="file" multiple className="hidden" onChange={(e) => setSelectedFiles(Array.from(e.target.files))} />
                              Upload Files
                            </label>
                            <label className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer inline-flex items-center">
                              <Folder className="w-4 h-4 mr-2 inline" />
                              <input type="file" multiple webkitdirectory="" className="hidden" onChange={(e) => {
                                const files = Array.from(e.target.files);
                                console.log('Folder upload debug - Original files:', files.map(f => ({
                                  name: f.name,
                                  webkitRelativePath: f.webkitRelativePath
                                })));
                                
                                // Store the webkitRelativePath in a custom property
                                const filesWithFolderStructure = files.map(file => {
                                  // Create a new File object and add the relative path as a custom property
                                  const fileWithPath = new File([file], file.name, { type: file.type });
                                  fileWithPath.relativePath = file.webkitRelativePath;
                                  console.log(`Processing file: ${file.name} -> ${file.webkitRelativePath}`);
                                  return fileWithPath;
                                });
                                
                                console.log('Folder upload debug - Processed files:', filesWithFolderStructure.map(f => ({
                                  name: f.name,
                                  relativePath: f.relativePath,
                                  size: f.size
                                })));
                                
                                setSelectedFiles(filesWithFolderStructure);
                              }} />
                              Upload Folder
                            </label>
                            <button onClick={async () => { await refreshFiles() }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                              <RefreshCw className="w-4 h-4 mr-2 inline" />
                              Refresh
                            </button>
                  </div>
                </div>
                
                <div className="h-96 border-2 border-dashed border-gray-300 rounded-lg p-4 overflow-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-600">
                      {files.length} files, {folders.length} folders
                    </div>
                    <div className="text-sm text-gray-500">{website.storage_used_mb ? formatStorage(website.storage_used_mb) : ''}</div>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Files to upload</div>
                      <ul className="space-y-2">
                        {selectedFiles.map((f, idx) => (
                          <li key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <span className="text-sm text-gray-800">
                              {f.relativePath || f.name}
                              {f.relativePath && f.relativePath !== f.name && (
                                <span className="text-xs text-gray-400 ml-2">(from folder)</span>
                              )}
                            </span>
                            <span className="text-xs text-gray-500">{(f.size/1024).toFixed(1)} KB</span>
                          </li>
                        ))}
                      </ul>
                      <div className="text-xs text-gray-500 mt-2">
                        Debug: {selectedFiles.length} files selected
                      </div>
                      <div className="mt-2 flex space-x-2">
                        <button disabled={uploading} onClick={async () => await handleUpload()} className="px-3 py-1 bg-blue-600 text-white rounded">Upload</button>
                        <button onClick={() => setSelectedFiles([])} className="px-3 py-1 border rounded">Cancel</button>
                      </div>
                    </div>
                  )}

                  <div>
                    {files.length === 0 && folders.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">No files or folders uploaded yet</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500">
                            <th>Name</th>
                            <th>Type</th>
                            <th>Size</th>
                            <th>Modified</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Display folders first */}
                          {folders.map((folder) => (
                            <tr key={`folder-${folder.name}`} className="border-t">
                              <td className="py-2 flex items-center">
                                <Folder className="w-4 h-4 text-blue-500 mr-2" />
                                {folder.name}
                              </td>
                              <td className="py-2 text-gray-500">Folder ({folder.file_count} files)</td>
                              <td className="py-2 text-gray-500">-</td>
                              <td className="py-2 text-gray-500">{folder.modified ? new Date(folder.modified).toLocaleString() : '-'}</td>
                              <td className="py-2 text-right">
                                <button onClick={() => handleDownload(folder.name)} className="px-2 py-1 text-sm mr-2 bg-gray-100 rounded">Download</button>
                                <button onClick={() => handleFileDelete(folder.name)} className="px-2 py-1 text-sm bg-red-50 text-red-600 rounded">Delete</button>
                              </td>
                            </tr>
                          ))}
                          {/* Display files */}
                          {files.map((f) => (
                            <tr key={`file-${f.name}`} className="border-t">
                              <td className="py-2 flex items-center">
                                <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                {f.name}
                              </td>
                              <td className="py-2 text-gray-500">File</td>
                              <td className="py-2 text-gray-500">{(f.size/1024).toFixed(1)} KB</td>
                              <td className="py-2 text-gray-500">{f.modified ? new Date(f.modified).toLocaleString() : '-'}</td>
                              <td className="py-2 text-right">
                                <button onClick={() => handleDownload(f.name)} className="px-2 py-1 text-sm mr-2 bg-gray-100 rounded">Download</button>
                                <button onClick={() => handleFileDelete(f.name)} className="px-2 py-1 text-sm bg-red-50 text-red-600 rounded">Delete</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
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
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
                    {!editingSettings ? (
                      <button
                        onClick={() => setEditingSettings(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        <Edit className="w-4 h-4 mr-2 inline" />
                        Edit
                      </button>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveSettings}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelSettings}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Website Name
                      </label>
                      <input
                        type="text"
                        value={settingsForm.name}
                        onChange={(e) => handleSettingsChange('name', e.target.value)}
                        disabled={!editingSettings}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          !editingSettings ? 'bg-gray-50 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={settingsForm.description}
                        onChange={(e) => handleSettingsChange('description', e.target.value)}
                        disabled={!editingSettings}
                        rows={3}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          !editingSettings ? 'bg-gray-50 cursor-not-allowed' : ''
                        }`}
                        placeholder="Optional description of your website"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Domain
                      </label>
                      <input
                        type="text"
                        value={getWebsiteUrl()}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                {/* Environment Variables */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Environment Variables</h3>
                    {!editingEnvVars ? (
                      <button
                        onClick={() => setEditingEnvVars(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        <Edit className="w-4 h-4 mr-2 inline" />
                        Edit
                      </button>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveEnvVars}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEnvVars}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {envVars.length === 0 ? (
                      <div className="text-center py-8">
                        <Terminal className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">No environment variables</p>
                        <p className="text-sm text-gray-500">Add environment variables for your application</p>
                      </div>
                    ) : (
                      envVars.map((envVar) => (
                        <div key={envVar.id} className="flex items-center space-x-3">
                          <input
                            type="text"
                            value={envVar.key}
                            onChange={(e) => handleEnvVarChange(envVar.id, 'key', e.target.value)}
                            disabled={!editingEnvVars}
                            placeholder="Variable name"
                            className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              !editingEnvVars ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
                          />
                          <span className="text-gray-400">=</span>
                          <input
                            type="text"
                            value={envVar.value}
                            onChange={(e) => handleEnvVarChange(envVar.id, 'value', e.target.value)}
                            disabled={!editingEnvVars}
                            placeholder="Variable value"
                            className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              !editingEnvVars ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
                          />
                          {editingEnvVars && (
                            <button
                              onClick={() => handleRemoveEnvVar(envVar.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                    
                    {editingEnvVars && (
                      <button
                        onClick={handleAddEnvVar}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors font-medium"
                      >
                        + Add Environment Variable
                      </button>
                    )}
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Environment variables are available during build and runtime. 
                      Changes will take effect on the next deployment.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">SSL Certificate</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">SSL encryption protects your website and visitors</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Status: {getSSLStatus() ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      {getSSLStatus() ? 'Renew SSL' : 'Enable SSL'}
                    </button>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-900">Delete Website</p>
                        <p className="text-xs text-red-700">This action cannot be undone</p>
                      </div>
                      <button 
                        onClick={openDeleteModal}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={closeDeleteModal}
          onConfirm={confirmDeleteWebsite}
          title="Delete Website"
          message={
            website 
              ? `Are you sure you want to delete "${website.name}"? This action cannot be undone and all files, databases, and configurations will be permanently lost.`
              : 'Are you sure you want to delete this website? This action cannot be undone.'
          }
          confirmText="Delete Website"
          type="danger"
          loading={deleteModal.loading}
        />
      </div>
    </>
  )
}
