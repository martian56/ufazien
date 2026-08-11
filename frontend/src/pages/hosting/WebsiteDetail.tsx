import { useState, useEffect } from "react"
import type { Deployment, Website } from "../../utils/hostingApi"

/** A folder upload attaches this; File has no writable name. */
type PickedFile = File & { relativePath?: string }
import WebsiteAnalyticsTab from "../../features/hosting/WebsiteAnalyticsTab"
import WebsiteDeploymentsTab from "../../features/hosting/WebsiteDeploymentsTab"
import WebsiteFilesTab from "../../features/hosting/WebsiteFilesTab"
import WebsiteOverviewTab from "../../features/hosting/WebsiteOverviewTab"
import WebsiteSettingsTab from "../../features/hosting/WebsiteSettingsTab"
import { formatDate, formatStorage, getSSLStatus, getStatusIcon, getWebsiteUrl } from "../../features/hosting/websiteFormat"
import { copyText } from "../../lib/clipboard"
import { errorMessage } from "../../lib/api/errors"
import { useParams, useNavigate } from "react-router-dom"
import { Helmet } from "react-helmet"
import {
  ArrowLeft,
  ExternalLink,
  Settings,
  Activity,
  FileText,
  Globe,
  Shield,
  Upload,
  Download,
  RefreshCw,
  Copy,
  AlertCircle,
  Clock,
  Eye,
  HardDrive,
  Zap,
  BarChart3,
} from "lucide-react"
import HostingSidebar from "../../components/hosting/HostingSidebar"
import ConfirmationModal from "../../components/ui/ConfirmationModal"
import { hostingApi } from "../../utils/hostingApi"
import { useWebsites } from "../../hooks/useWebsites.js"
import { useDialogs } from "../../components/ui/Dialogs"

export default function WebsiteDetail() {
  const { toast, confirm } = useDialogs()
  const { websiteId = "" } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [website, setWebsite] = useState<Website | null>(null)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingSettings, setEditingSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: ""
  })
  const [envVars, setEnvVars] = useState<{ id: string; key: string; value: string }[]>([])
  const [editingEnvVars, setEditingEnvVars] = useState(false)
  const [files, setFiles] = useState<{ name: string; size: number; modified?: string | null }[]>([])
  const [folders, setFolders] = useState<{ name: string; file_count: number; modified?: string | null }[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<PickedFile[]>([])
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, loading: false })
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null)
  const [filesError, setFilesError] = useState<string | null>(null)
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
        const deploymentsData = (await hostingApi.getWebsiteDeployments(websiteId)) as Deployment[] | { results?: Deployment[] }
        setDeployments(Array.isArray(deploymentsData) ? deploymentsData : deploymentsData?.results ?? [])

        // Fetch analytics (with fallback for errors)
        try {
          const analyticsData = (await hostingApi.getWebsiteAnalytics(websiteId)) as Record<string, unknown>
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
        setError(errorMessage(err, 'Failed to load website data'))
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
      const res = (await hostingApi.listFiles(websiteId)) as { files?: typeof files; folders?: typeof folders }
      setFiles(res.files || [])
      setFolders(res.folders || [])
      setFilesError(null)
    } catch (err) {
      // A failed listing used to be swallowed into empty arrays, so the tab
      // said "No files or folders uploaded yet" when the server had actually
      // refused. Website.domain is SET_NULL, so a deleted domain leaves every
      // file operation returning 400 and the site looking merely empty.
      setFiles([])
      setFolders([])
      setFilesError(errorMessage(err, 'Could not load files'))
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
        
        // Create a new File object with the correct name
        const fileToUpload = new File([f], fileName, { type: f.type })
        fd.append('files', fileToUpload)
      })
      await hostingApi.uploadFiles(websiteId, fd)
      setSelectedFiles([])
      await refreshFiles()
    } catch (err) {
      toast.error('Upload failed. ' + errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const handleFileDelete = async (filename: string) => {
    const ok = await confirm({
      title: `Delete ${filename}?`,
      message: 'This removes the file from the live site.',
      confirmText: 'Delete file',
    })
    if (!ok) return
    try {
      await hostingApi.deleteFile(websiteId, filename)
      await refreshFiles()
    } catch (err) {
      toast.error('Could not delete that file. ' + errorMessage(err))
    }
  }

  const handleDownload = async (filename: string) => {
    try {
      // Use the authenticated API to download the file
      const response = (await hostingApi.downloadFile(websiteId, filename)) as Response
      
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
      toast.error('Download failed. ' + errorMessage(err))
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
      const deploymentsData = (await hostingApi.getWebsiteDeployments(websiteId)) as Deployment[] | { results?: Deployment[] }
      setDeployments(Array.isArray(deploymentsData) ? deploymentsData : deploymentsData?.results ?? [])
    } catch (err) {
      toast.error('Could not deploy the website. ' + errorMessage(err))
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
      toast.error('Could not delete the website. ' + errorMessage(err))
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  const handleSettingsChange = (field: "name" | "description", value: string) => {
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
      toast.error('Could not save those settings. ' + errorMessage(err))
    }
  }

  const handleCancelSettings = () => {
    setSettingsForm({
      name: website?.name || "",
      description: website?.description || ""
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

  const handleEnvVarChange = (id: string, field: "key" | "value", value: string) => {
    setEnvVars(prev => prev.map(envVar => 
      envVar.id === id ? { ...envVar, [field]: value } : envVar
    ))
  }

  const handleRemoveEnvVar = (id: string) => {
    setEnvVars(prev => prev.filter(envVar => envVar.id !== id))
  }

  const handleSaveEnvVars = async () => {
    try {
      // Convert array back to object format for API
      const envVarObject: Record<string, string> = {}
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
      toast.error('Could not save the environment variables. ' + errorMessage(err))
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

  const handleCopyUrl = async () => {
    const ok = await copyText(`https://${getWebsiteUrl(website)}`)
    setCopied(ok ? 'copied' : 'failed')
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Website Details | Ufazien Hosting</title>
        </Helmet>
        <div className="min-h-screen bg-white">
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
        <div className="min-h-screen bg-white">
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
      <div className="min-h-screen bg-white">
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
                      onClick={handleCopyUrl}
                      className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Globe className="w-4 h-4 mr-1" />
                      {getWebsiteUrl(website)}
                      <Copy className="w-3 h-3 ml-1" />
                    </button>
                    {copied && (
                      <span className={`text-sm ${copied === 'copied' ? 'text-green-600' : 'text-red-600'}`}>
                        {copied === 'copied' ? 'Copied' : 'Could not copy'}
                      </span>
                    )}
                    {getSSLStatus(website) && (
                      <span className="flex items-center text-green-600 text-sm">
                        <Shield className="w-4 h-4 mr-1" />
                        SSL Enabled
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <a 
                    href={`https://${getWebsiteUrl(website)}`} 
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
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center">
                    <Eye className="w-6 h-6 text-blue-600 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Total Visits</p>
                      <p className="text-lg font-semibold text-gray-900">{(website.total_visits || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center">
                    <HardDrive className="w-6 h-6 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Storage Used</p>
                      <p className="text-lg font-semibold text-gray-900">{formatStorage(website.storage_used_mb)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
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

                <div className="bg-white rounded-lg border border-gray-200 p-4">
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
                <nav className="-mb-px flex gap-6 sm:gap-8 overflow-x-auto whitespace-nowrap">
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
              <WebsiteOverviewTab
                website={website}
                deployments={deployments}
                onDeploy={handleDeploy}
                onViewLogs={() => setActiveTab('deployments')}
              />
            )}

            {activeTab === 'deployments' && (
              <WebsiteDeploymentsTab deployments={deployments} onDeploy={handleDeploy} />
            )}

            {activeTab === 'files' && (
              <WebsiteFilesTab
                website={website}
                files={files}
                folders={folders}
                selectedFiles={selectedFiles}
                onSelectFiles={setSelectedFiles}
                uploading={uploading}
                onUpload={handleUpload}
                onDownload={handleDownload}
                onDelete={handleFileDelete}
                onRefresh={refreshFiles}
                error={filesError}
              />
            )}

            {activeTab === 'analytics' && (
              <WebsiteAnalyticsTab website={website} analytics={analytics} />
            )}

            {activeTab === 'settings' && (
              <WebsiteSettingsTab
                website={website}
                editingSettings={editingSettings}
                onEditSettings={() => setEditingSettings(true)}
                settingsForm={settingsForm}
                onSettingsChange={handleSettingsChange}
                onSaveSettings={handleSaveSettings}
                onCancelSettings={handleCancelSettings}
                envVars={envVars}
                editingEnvVars={editingEnvVars}
                onEditEnvVars={() => setEditingEnvVars(true)}
                onEnvVarChange={handleEnvVarChange}
                onAddEnvVar={handleAddEnvVar}
                onRemoveEnvVar={handleRemoveEnvVar}
                onSaveEnvVars={handleSaveEnvVars}
                onCancelEnvVars={handleCancelEnvVars}
                onDeleteWebsite={openDeleteModal}
              />
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
