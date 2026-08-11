import { useState, useEffect } from "react"
import { errorMessage } from "../../lib/api/errors"
import { useNavigate } from "react-router-dom"
import { Helmet } from "react-helmet"
import {
  Plus,
  Globe,
  ExternalLink,
  Settings,
  Activity,
  Trash2,
  Edit,
  Play,
  Square,
  RefreshCw,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Clock,
  Crown
} from "lucide-react"
import HostingSidebar from "../../components/hosting/HostingSidebar"
import UpgradePrompt from "../../components/hosting/UpgradePrompt"
import { useSubscription } from "../../hooks/useSubscription"
import { useWebsites } from "../../hooks/useWebsites"
import Select from "../../components/ui/Select"
import { useDialogs } from "../../components/ui/Dialogs"
import Spinner from "../../components/ui/Spinner"

export default function Websites() {
  const { toast, confirm } = useDialogs()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  
  const { subscription } = useSubscription()
  const { websites, loading, error, canCreate, deleteWebsite, deployWebsite } = useWebsites()

  const handleCreateWebsite = () => {
    if (!canCreate) {
      setShowUpgradePrompt(true)
      return
    }
    navigate('/hosting/websites/create')
  }

  const handleDeleteWebsite = async (websiteId: string) => {
    const ok = await confirm({
      title: 'Delete this website?',
      message: 'The site and its files are removed for good.',
      confirmText: 'Delete website',
    })
    if (!ok) return
    try {
      await deleteWebsite(websiteId)
    } catch (error) {
      toast.error('Could not delete the website. ' + errorMessage(error))
    }
  }

  const handleDeployWebsite = async (websiteId: string) => {
    try {
      await deployWebsite(websiteId)
    } catch (error) {
      toast.error('Could not deploy the website. ' + errorMessage(error))
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'building':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'stopped':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'building':
        return 'Building'
      case 'stopped':
        return 'Stopped'
      default:
        return 'Unknown'
    }
  }

  const filteredWebsites = websites.filter(website => {
    const matchesSearch = website.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (website.domain?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || website.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Websites | Ufazien Hosting</title>
          <meta name="description" content="Manage all your hosted websites" />
        </Helmet>
        <div className="min-h-screen bg-white">
          <HostingSidebar />
          <div className="ml-64">
            <div className="flex items-center justify-center h-64">
              <Spinner size="lg" />
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
          <title>Websites | Ufazien Hosting</title>
          <meta name="description" content="Manage all your hosted websites" />
        </Helmet>
        <div className="min-h-screen bg-white">
          <HostingSidebar />
          <div className="ml-64">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading websites</h3>
                <p className="text-gray-600">{error}</p>
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
        <title>Websites | Ufazien Hosting</title>
        <meta name="description" content="Manage all your hosted websites" />
      </Helmet>
      <div className="min-h-screen bg-white">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">{/* Added top padding for mobile menu button */}
            {/* Header */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Websites</h1>
                  <p className="mt-2 text-gray-600">Manage all your hosted websites</p>
                  {/* Usage Stats */}
                  <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <span>Websites: {filteredWebsites.length} / {subscription?.plan?.max_websites || 5}</span>
                      {!canCreate && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <Crown className="w-3 h-3" />
                          <span className="text-xs">Upgrade to create more</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 sm:mt-0">
                  <button 
                    onClick={handleCreateWebsite}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Website
                  </button>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search websites..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <Select
        value={statusFilter}
        onChange={(value) => setStatusFilter(value)}
        options={[
          { value: "all", label: "All Status" },
          { value: "active", label: "Active" },
          { value: "building", label: "Building" },
          { value: "stopped", label: "Stopped" },
        ]}
      />
              </div>
            </div>

            {/* Websites Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWebsites.map((website) => (
                <div key={website.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-gray-100 rounded-lg p-2">
                          <Globe className="h-5 w-5 text-gray-700" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{website.name}</h3>
                          <p className="text-sm text-gray-500">{website.domain?.name || `${website.name.toLowerCase()}.ufazien.com`}</p>
                        </div>
                      </div>
                      <div className="relative">
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreVertical className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Status</span>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(website.status)}
                          <span className="text-sm font-medium">{getStatusText(website.status)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Type</span>
                        <span className="text-sm font-medium capitalize">{website.website_type || 'static'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Storage</span>
                        <span className="text-sm font-medium">{website.storage_used_mb ? `${website.storage_used_mb} MB` : '0 MB'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Visits</span>
                        <span className="text-sm font-medium">{(website.total_visits || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="mt-6 flex space-x-2">
                      <button
                        onClick={() => navigate(`/hosting/website/${website.id}`)}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Manage
                      </button>
                      <a 
                        href={`https://${website.domain?.name}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-5 h-5 text-gray-600" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredWebsites.length === 0 && (
              <div className="text-center py-12">
                <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No websites found</h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your search or filters"
                    : "Get started by creating your first website"
                  }
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <button 
                    onClick={handleCreateWebsite}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Website
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upgrade Prompt Modal */}
        <UpgradePrompt
          isVisible={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          title="You have reached your plan's limit"
          description="Upgrade to add more websites to your account."
          feature="websites"
          currentUsage={filteredWebsites.length}
          limit={subscription?.plan?.max_websites || 5}
        />
      </div>
    </>
  )
}
