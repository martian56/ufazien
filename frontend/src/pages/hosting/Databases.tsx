import { useState, useEffect } from "react"
import type { HostingDatabase } from "../../utils/hostingApi"
import { errorMessage } from "../../lib/api/errors"
import { copyText } from "../../lib/clipboard"
import { Helmet } from "react-helmet"
import { useNavigate } from "react-router-dom"
import {
  Plus,
  Database,
  Settings,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Crown,
  Key,
  X,
  Save
} from "lucide-react"
import HostingSidebar from "../../components/hosting/HostingSidebar"
import UpgradePrompt from "../../components/hosting/UpgradePrompt"
import ConfirmationModal from "../../components/ui/ConfirmationModal"
import { useSubscription } from "../../hooks/useSubscription"
import { useDatabases } from "../../hooks/useDatabases.js"
import Select from "../../components/ui/Select"
import { useDialogs } from "../../components/ui/Dialogs"

export default function Databases() {
  const { toast, confirm } = useDialogs()
  const navigate = useNavigate()
  const { subscription } = useSubscription()
  const { databases, loading, error, canCreate, deleteDatabase, updateDatabase } = useDatabases()
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [changingPassword, setChangingPassword] = useState<Record<string, boolean>>({})
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({})
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; database: HostingDatabase | null; loading: boolean }>({ isOpen: false, database: null, loading: false })

  const handleCreateDatabase = () => {
    if (!canCreate) {
      setShowUpgradePrompt(true)
      return
    }
    navigate('/hosting/databases/create')
  }

  const handleDeleteDatabase = async (databaseId: string) => {
    const ok = await confirm({
      title: 'Delete this database?',
      message: 'Everything in it goes with it. This cannot be undone.',
      confirmText: 'Delete database',
    })
    if (!ok) return
    try {
      await deleteDatabase(databaseId)
    } catch (error) {
      toast.error('Could not delete the database. ' + errorMessage(error))
    }
  }

  const openDeleteModal = (database: HostingDatabase) => {
    setDeleteModal({ isOpen: true, database, loading: false })
  }

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, database: null, loading: false })
  }

  const confirmDeleteDatabase = async () => {
    if (!deleteModal.database) return

    setDeleteModal(prev => ({ ...prev, loading: true }))
    
    try {
      await deleteDatabase(deleteModal.database.id)
      closeDeleteModal()
    } catch (error) {
      toast.error('Could not delete the database. ' + errorMessage(error))
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'maintenance':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'maintenance':
        return 'Maintenance'
      default:
        return 'Unknown'
    }
  }

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const copyToClipboard = (text: string) => {
    void copyText(text)
  }

  const startPasswordChange = (databaseId: string) => {
    setChangingPassword(prev => ({ ...prev, [databaseId]: true }))
    setNewPasswords(prev => ({ ...prev, [databaseId]: '' }))
  }

  const cancelPasswordChange = (databaseId: string) => {
    setChangingPassword(prev => ({ ...prev, [databaseId]: false }))
    setNewPasswords(prev => ({ ...prev, [databaseId]: '' }))
  }

  const handlePasswordChange = async (databaseId: string) => {
    const newPassword = newPasswords[databaseId]
    if (!newPassword || newPassword.length < 8) {
      toast.error('The password needs at least 8 characters.')
      return
    }

    try {
      await updateDatabase(databaseId, { password: newPassword })
      setChangingPassword(prev => ({ ...prev, [databaseId]: false }))
      setNewPasswords(prev => ({ ...prev, [databaseId]: '' }))
      toast.success('Password updated.')
    } catch (error) {
      toast.error('Could not update the password. ' + errorMessage(error))
    }
  }

  const formatDatabaseSize = (sizeMb?: number | null) => {
    if (!sizeMb || sizeMb === 0) return '0 MB'
    if (sizeMb < 1024) return `${sizeMb} MB`
    return `${(sizeMb / 1024).toFixed(1)} GB`
  }

  const filteredDatabases = databases.filter(database => {
    const matchesSearch = database.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         database.db_type?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === "all" || database.db_type === typeFilter
    return matchesSearch && matchesType
  })

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Databases | Ufazien Hosting</title>
          <meta name="description" content="Manage your MySQL and PostgreSQL databases" />
        </Helmet>
        <div className="min-h-screen bg-white">
          <HostingSidebar />
          <div className="lg:ml-64">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
          <title>Databases | Ufazien Hosting</title>
          <meta name="description" content="Manage your MySQL and PostgreSQL databases" />
        </Helmet>
        <div className="min-h-screen bg-white">
          <HostingSidebar />
          <div className="lg:ml-64">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading databases</h3>
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
        <title>Databases | Ufazien Hosting</title>
        <meta name="description" content="Manage your MySQL and PostgreSQL databases" />
      </Helmet>
      <div className="min-h-screen bg-white">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">{/* Added top padding for mobile menu button */}
            {/* Header */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Databases</h1>
                  <p className="mt-2 text-gray-600">Manage your MySQL and PostgreSQL databases</p>
                  {/* Usage Stats */}
                  <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <span>Databases: {filteredDatabases.length} / {subscription?.plan?.max_databases || 5}</span>
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
                    onClick={handleCreateDatabase}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Database
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
                  placeholder="Search databases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <Select
        value={typeFilter}
        onChange={(value) => setTypeFilter(value)}
        options={[
          { value: "all", label: "All Types" },
          { value: "mysql", label: "MySQL" },
          { value: "postgresql", label: "PostgreSQL" },
        ]}
      />
              </div>
            </div>

            {/* Databases List */}
            <div className="space-y-4">
              {filteredDatabases.map((database) => (
                <div key={database.id} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="bg-gray-100 rounded-lg p-2">
                        <Database className="h-5 w-5 text-gray-700" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{database.name}</h3>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-gray-500 capitalize">{database.db_type || 'Unknown'}</span>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(database.status)}
                            <span className="text-sm">{getStatusText(database.status)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="p-2 hover:bg-gray-100 rounded-lg">
                        <Settings className="h-4 w-4 text-gray-400" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg">
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Host</label>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">{database.host}</code>
                        <button 
                          onClick={() => copyToClipboard(database.host ?? "")}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Copy className="h-3 w-3 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Port</label>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">{database.port ?? "-"}</code>
                        <button 
                          onClick={() => copyToClipboard(String(database.port ?? ""))}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Copy className="h-3 w-3 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Username</label>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">{database.username}</code>
                        <button 
                          onClick={() => copyToClipboard(database.username ?? "")}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Copy className="h-3 w-3 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Password</label>
                      {changingPassword[database.id] ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="password"
                            value={newPasswords[database.id] || ''}
                            onChange={(e) => setNewPasswords(prev => ({ ...prev, [database.id]: e.target.value }))}
                            placeholder="Enter new password"
                            className="text-sm border border-gray-300 px-2 py-1 rounded flex-1"
                          />
                          <button 
                            onClick={() => handlePasswordChange(database.id)}
                            className="p-1 hover:bg-green-100 rounded text-green-600"
                            title="Save new password"
                          >
                            <Save className="h-3 w-3" />
                          </button>
                          <button 
                            onClick={() => cancelPasswordChange(database.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                            title="Cancel"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1">
                            {showPassword[database.id] ? database.password : '••••••••••••'}
                          </code>
                          <button 
                            onClick={() => togglePasswordVisibility(database.id)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Toggle password visibility"
                          >
                            {showPassword[database.id] ? <EyeOff className="h-3 w-3 text-gray-400" /> : <Eye className="h-3 w-3 text-gray-400" />}
                          </button>
                          <button 
                            onClick={() => copyToClipboard(database.password ?? "")}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Copy password"
                          >
                            <Copy className="h-3 w-3 text-gray-400" />
                          </button>
                          <button 
                            onClick={() => startPasswordChange(database.id)}
                            className="p-1 hover:bg-blue-100 rounded text-blue-600"
                            title="Change password"
                          >
                            <Key className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Size: <span className="font-medium">{formatDatabaseSize(database.size_mb)}</span></span>
                      <span>Created: <span className="font-medium">{database.created_at ? new Date(database.created_at).toLocaleDateString() : 'Unknown'}</span></span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        Backup
                      </button>
                      <button 
                        onClick={() => openDeleteModal(database)}
                        className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredDatabases.length === 0 && (
              <div className="text-center py-12">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No databases found</h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || typeFilter !== "all" 
                    ? "Try adjusting your search or filters"
                    : "Get started by creating your first database"
                  }
                </p>
                {!searchTerm && typeFilter === "all" && (
                  <button 
                    onClick={handleCreateDatabase}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Database
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
          description="Upgrade to add more databases to your account."
          feature="databases"
          currentUsage={filteredDatabases.length}
          limit={subscription?.plan?.max_databases || 5}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={closeDeleteModal}
          onConfirm={confirmDeleteDatabase}
          title="Delete Database"
          message={
            deleteModal.database 
              ? `Are you sure you want to delete "${deleteModal.database.name}"? This action cannot be undone and all data will be permanently lost.`
              : ''
          }
          confirmText="Delete Database"
          type="danger"
          loading={deleteModal.loading}
        />
      </div>
    </>
  )
}
