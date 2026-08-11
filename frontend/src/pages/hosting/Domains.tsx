import { useState, useEffect } from "react"
import type { Domain } from "../../utils/hostingApi"
import { errorMessage } from "../../lib/api/errors"
import { Server, Plus, Globe, Shield, Trash2, Edit, ExternalLink, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react"
import { Helmet } from "react-helmet"
import HostingSidebar from "../../components/hosting/HostingSidebar"
import { useDomains } from "../../hooks/useDomains"
import Radio from "../../components/ui/Radio"
import Spinner from "../../components/ui/Spinner"

export default function Domains() {
  const { 
    loading, 
    error, 
    domains, 
    availableDomains,
    createDomain, 
    deleteDomain,
    updateDomain,
    refreshDomains 
  } = useDomains()

  const [showAddModal, setShowAddModal] = useState(false)
  const [domainType, setDomainType] = useState('subdomain')
  const [domainName, setDomainName] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // Status badge component
  const StatusBadge = ({ status }: { status?: string }) => {
    const statusConfig = {
      active: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', text: 'Active' },
      pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', text: 'Pending' },
      expired: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', text: 'Expired' },
      error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', text: 'Error' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
      </span>
    )
  }

  // Domain type badge component
  const DomainTypeBadge = ({ type }: { type?: string }) => {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        type === 'subdomain' 
          ? 'bg-blue-100 text-blue-800' 
          : 'bg-purple-100 text-purple-800'
      }`}>
        {type === 'subdomain' ? (
          <>
            <Server className="w-3 h-3 mr-1" />
            Subdomain
          </>
        ) : (
          <>
            <Globe className="w-3 h-3 mr-1" />
            Custom Domain
          </>
        )}
      </span>
    )
  }

  const handleAddDomain = async () => {
    if (!domainName.trim()) {
      setFormError('Domain name is required')
      return
    }

    // Validate domain format
    if (domainType === 'subdomain') {
      if (!/^[a-z0-9-]+$/.test(domainName)) {
        setFormError('Subdomain can only contain lowercase letters, numbers, and hyphens')
        return
      }
      // Check if subdomain already exists
      const fullSubdomain = `${domainName}.ufazien.com`
      if (domains.some(d => d.name === fullSubdomain)) {
        setFormError('This subdomain already exists')
        return
      }
    } else {
      // Basic custom domain validation
      if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,})+$/.test(domainName)) {
        setFormError('Please enter a valid domain name (e.g., example.com)')
        return
      }
      if (domains.some(d => d.name === domainName)) {
        setFormError('This domain already exists')
        return
      }
    }

    setSubmitting(true)
    setFormError('')

    try {
      const domainData = {
        name: domainType === 'subdomain' ? `${domainName}.ufazien.com` : domainName,
        domain_type: domainType
      }
      
      await createDomain(domainData)
      setShowAddModal(false)
      setDomainName('')
      setDomainType('subdomain')
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to create domain'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteDomain = async (domainId: number) => {
    try {
      await deleteDomain(domainId)
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete domain:', err)
    }
  }

  const getUsageInfo = (domain: Domain) => {
    // Check if domain is being used by a website
    const isUsed = !availableDomains.some(d => d.id === domain.id)
    return isUsed ? 'In use' : 'Available'
  }

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Domains | Ufazien Hosting</title>
          <meta name="description" content="Manage your domains and subdomains" />
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

  return (
    <>
      <Helmet>
        <title>Domains | Ufazien Hosting</title>
        <meta name="description" content="Manage your domains and subdomains" />
      </Helmet>
      <div className="min-h-screen bg-white">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-gray-100 rounded-lg p-2">
                    <Server className="h-6 w-6 text-gray-700" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Domains</h1>
                    <p className="mt-2 text-gray-600">Manage your domains and subdomains</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Domain</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Domains List */}
            <div className="bg-white rounded-lg border border-gray-200">
              {domains.length === 0 ? (
                <div className="text-center py-12">
                  <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No domains yet</h3>
                  <p className="text-gray-600 mb-4">Start by adding your first domain or subdomain</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Domain</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Domain
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Usage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          SSL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {domains.map((domain) => (
                        <tr key={domain.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Globe className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="text-sm font-medium text-gray-900">{domain.name}</span>
                              <a
                                href={`https://${domain.name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-gray-400 hover:text-gray-600"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <DomainTypeBadge type={domain.domain_type} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={domain.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {getUsageInfo(domain)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Shield className={`h-4 w-4 mr-1 ${domain.ssl_enabled ? 'text-green-500' : 'text-gray-400'}`} />
                              <span className={`text-sm ${domain.ssl_enabled ? 'text-green-600' : 'text-gray-500'}`}>
                                {domain.ssl_enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {domain.created_at ? new Date(domain.created_at).toLocaleDateString() : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setDeleteConfirm(domain.id)}
                                className="text-red-600 hover:text-red-900 transition-colors"
                                disabled={getUsageInfo(domain) === 'In use'}
                                title={getUsageInfo(domain) === 'In use' ? 'Cannot delete domain in use' : 'Delete domain'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Domain Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Domain</h3>
              
              {/* Domain Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Domain Type</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <Radio
                      name="domainType"
                      value="subdomain"
                      checked={domainType === 'subdomain'}
                      onSelect={(value) => setDomainType(value)}
                      className="mr-2"
                    />
                    <span className="text-sm">Subdomain (free .ufazien.com)</span>
                  </label>
                  <label className="flex items-center">
                    <Radio
                      name="domainType"
                      value="custom"
                      checked={domainType === 'custom'}
                      onSelect={(value) => setDomainType(value)}
                      className="mr-2"
                    />
                    <span className="text-sm">Custom Domain (your own domain)</span>
                  </label>
                </div>
              </div>

              {/* Domain Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {domainType === 'subdomain' ? 'Subdomain' : 'Domain Name'}
                </label>
                {domainType === 'subdomain' ? (
                  <div className="flex">
                    <input
                      type="text"
                      value={domainName}
                      onChange={(e) => setDomainName(e.target.value.toLowerCase())}
                      placeholder="mysite"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-500">
                      .ufazien.com
                    </span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={domainName}
                    onChange={(e) => setDomainName(e.target.value.toLowerCase())}
                    placeholder="example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                )}
                {domainType === 'custom' && (
                  <p className="mt-2 text-xs text-gray-500">
                    Make sure to point your domain's DNS to our servers after adding it.
                  </p>
                )}
              </div>

              {formError && (
                <div className="mb-4 text-sm text-red-600">{formError}</div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setDomainName('')
                    setFormError('')
                    setDomainType('subdomain')
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddDomain}
                  disabled={submitting || !domainName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Adding...' : 'Add Domain'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Domain</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this domain? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteDomain(deleteConfirm)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
