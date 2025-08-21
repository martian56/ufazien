import { useState, useEffect } from "react"
import { 
  Shield, 
  Plus, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Upload,
  Download,
  Globe,
  Lock,
  Unlock,
  Settings,
  Trash2,
  ExternalLink,
  Info
} from "lucide-react"
import { Helmet } from "react-helmet"
import HostingSidebar from "../../components/hosting/HostingSidebar"
import { hostingApi } from "../../utils/hostingApi.js"
import { useWebsites } from "../../hooks/useWebsites.js"
import ConfirmationModal from "../../components/ui/ConfirmationModal"

export default function SSL() {
  const [loading, setLoading] = useState(true)
  const [certificates, setCertificates] = useState([])
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, certificate: null, loading: false })
  const [viewModal, setViewModal] = useState({ isOpen: false, certificate: null })
  const [createForm, setCreateForm] = useState({
    domain: '',
    type: 'auto', // 'auto' or 'custom'
    certificate_data: '',
    private_key: '',
    auto_renew: true
  })
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  
  const { websites } = useWebsites()

  // Fetch SSL certificates
  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Get SSL certificates
        const response = await hostingApi.getSSLCertificates()
        
        // Generate mock data if no real data available
        const mockCertificates = [
          {
            id: 1,
            domain: { name: 'example.ufazien.com' },
            status: 'active',
            issuer: "Let's Encrypt",
            issued_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            auto_renew: true,
            certificate_data: '-----BEGIN CERTIFICATE-----\nMIIE... (truncated)\n-----END CERTIFICATE-----'
          },
          {
            id: 2,
            domain: { name: 'blog.ufazien.com' },
            status: 'pending',
            issuer: "Let's Encrypt",
            issued_at: null,
            expires_at: null,
            auto_renew: true,
            certificate_data: ''
          },
          {
            id: 3,
            domain: { name: 'shop.ufazien.com' },
            status: 'active',
            issuer: 'Custom Certificate',
            issued_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            auto_renew: false,
            certificate_data: '-----BEGIN CERTIFICATE-----\nMIIE... (custom cert)\n-----END CERTIFICATE-----'
          }
        ]
        
        setCertificates(response.results || response || mockCertificates)
      } catch (err) {
        console.error('Failed to fetch SSL certificates:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCertificates()
  }, [])

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />
      case 'expired':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50'
      case 'expired':
        return 'text-red-600 bg-red-50'
      case 'error':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null
    const days = Math.floor((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    return days
  }

  const handleCreateCertificate = async () => {
    try {
      // Prepare data for API (exclude 'type' field which is frontend-only)
      const { type, ...apiData } = createForm
      
      // Only include certificate_data and private_key for custom certificates
      if (type === 'auto') {
        delete apiData.certificate_data
        delete apiData.private_key
      }
      
      const newCert = await hostingApi.createSSLCertificate(apiData)
      setCertificates(prev => [...prev, newCert])
      setShowCreateModal(false)
      setCreateForm({
        domain: '',
        type: 'auto',
        certificate_data: '',
        private_key: '',
        auto_renew: true
      })
    } catch (err) {
      console.error('SSL Certificate creation error:', err)
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.response?.data?.error ||
                          err.message || 
                          'Unknown error occurred'
      alert('Failed to create SSL certificate: ' + errorMessage)
    }
  }

  const handleDeleteCertificate = async (certificate) => {
    setDeleteModal({ isOpen: true, certificate, loading: false })
  }

  const confirmDeleteCertificate = async () => {
    setDeleteModal(prev => ({ ...prev, loading: true }))
    
    try {
      await hostingApi.deleteSSLCertificate(deleteModal.certificate.id)
      setCertificates(prev => prev.filter(cert => cert.id !== deleteModal.certificate.id))
      setDeleteModal({ isOpen: false, certificate: null, loading: false })
    } catch (err) {
      console.error('Delete SSL certificate error:', err)
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.response?.data?.error ||
                          err.message || 
                          'Unknown error occurred'
      alert('Failed to delete certificate: ' + errorMessage)
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  const handleRenewCertificate = async (certificateId) => {
    try {
      await hostingApi.renewSSLCertificate(certificateId)
      // Refresh the certificates list to get updated status
      const response = await hostingApi.getSSLCertificates()
      setCertificates(response.results || response)
      alert('Certificate renewal initiated!')
    } catch (err) {
      console.error('Renew SSL certificate error:', err)
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.response?.data?.error ||
                          err.message || 
                          'Unknown error occurred'
      alert('Failed to renew certificate: ' + errorMessage)
    }
  }

  if (loading) {
    return (
      <>
        <Helmet>
          <title>SSL Certificates | Ufazien Hosting</title>
          <meta name="description" content="Manage SSL certificates for your websites" />
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

  return (
    <>
      <Helmet>
        <title>SSL Certificates | Ufazien Hosting</title>
        <meta name="description" content="Manage SSL certificates for your websites" />
      </Helmet>
      <div className="min-h-screen bg-gray-50">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 rounded-lg p-2">
                    <Shield className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">SSL Certificates</h1>
                    <p className="mt-2 text-gray-600">Manage SSL certificates for your websites</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4 mr-2 inline" />
                  Add Certificate
                </button>
              </div>

              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                  <div>
                    <p className="text-blue-900 font-medium">Automatic SSL Certificates</p>
                    <p className="text-blue-700 text-sm mt-1">
                      Every website gets a free Let's Encrypt SSL certificate automatically. 
                      You can also upload your own custom certificates.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
                  <p className="text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* SSL Certificates List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">SSL Certificates</h3>
              </div>
              
              <div className="divide-y divide-gray-200">
                {certificates.length === 0 ? (
                  <div className="p-8 text-center">
                    <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No SSL certificates</h3>
                    <p className="text-gray-600 mb-4">
                      SSL certificates are created automatically when you add a website.
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add Custom Certificate
                    </button>
                  </div>
                ) : (
                  certificates.map((certificate) => {
                    const daysUntilExpiry = getDaysUntilExpiry(certificate.expires_at)
                    const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry < 30
                    const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0

                    return (
                      <div key={certificate.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {getStatusIcon(certificate.status)}
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="font-medium text-gray-900">
                                  {certificate.domain_name || 'Unknown Domain'}
                                </h3>
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(certificate.status)}`}>
                                  {certificate.status}
                                </span>
                                {certificate.auto_renew && (
                                  <span className="px-2 py-1 text-xs rounded-full font-medium text-green-600 bg-green-50">
                                    Auto-renew
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                                <span>Issuer: {certificate.issuer}</span>
                                <span>•</span>
                                <span>Issued: {formatDate(certificate.issued_at)}</span>
                                <span>•</span>
                                <span>Expires: {formatDate(certificate.expires_at)}</span>
                                {daysUntilExpiry !== null && (
                                  <>
                                    <span>•</span>
                                    <span className={`${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-yellow-600' : 'text-green-600'}`}>
                                      {isExpired ? 'Expired' : `${daysUntilExpiry} days left`}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {(isExpiringSoon || isExpired) && certificate.auto_renew && (
                              <button
                                onClick={() => handleRenewCertificate(certificate.id)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Renew certificate"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setViewModal({ isOpen: true, certificate })}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View certificate details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCertificate(certificate)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete certificate"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {(isExpiringSoon || isExpired) && (
                          <div className={`mt-3 p-3 rounded-lg ${isExpired ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                            <div className="flex items-start">
                              <AlertTriangle className={`w-4 h-4 mr-2 mt-0.5 ${isExpired ? 'text-red-600' : 'text-yellow-600'}`} />
                              <div>
                                <p className={`text-sm font-medium ${isExpired ? 'text-red-800' : 'text-yellow-800'}`}>
                                  {isExpired ? 'Certificate Expired' : 'Certificate Expiring Soon'}
                                </p>
                                <p className={`text-xs mt-1 ${isExpired ? 'text-red-700' : 'text-yellow-700'}`}>
                                  {isExpired 
                                    ? 'This certificate has expired and needs immediate renewal.'
                                    : `This certificate will expire in ${daysUntilExpiry} days.`
                                  }
                                  {certificate.auto_renew && ' Auto-renewal is enabled.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Create Certificate Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Add SSL Certificate</h2>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Certificate Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Certificate Type
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setCreateForm(prev => ({ ...prev, type: 'auto' }))}
                      className={`p-4 border rounded-lg text-left transition-colors ${
                        createForm.type === 'auto' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        <Lock className="w-5 h-5 text-green-600 mr-2" />
                        <span className="font-medium">Automatic (Let's Encrypt)</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Free SSL certificate that auto-renews
                      </p>
                    </button>
                    
                    <button
                      onClick={() => setCreateForm(prev => ({ ...prev, type: 'custom' }))}
                      className={`p-4 border rounded-lg text-left transition-colors ${
                        createForm.type === 'custom' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        <Upload className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="font-medium">Custom Certificate</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Upload your own SSL certificate
                      </p>
                    </button>
                  </div>
                </div>

                {/* Domain Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Domain
                  </label>
                  <select
                    value={createForm.domain}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, domain: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a domain</option>
                    {websites?.map(website => (
                      <option key={website.id} value={website.domain?.name || `${website.name}.ufazien.com`}>
                        {website.domain?.name || `${website.name}.ufazien.com`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom Certificate Fields */}
                {createForm.type === 'custom' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Certificate (PEM format)
                      </label>
                      <textarea
                        value={createForm.certificate_data}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, certificate_data: e.target.value }))}
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        placeholder="-----BEGIN CERTIFICATE-----
MIIE...
-----END CERTIFICATE-----"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Private Key (PEM format)
                      </label>
                      <div className="relative">
                        <textarea
                          type={showPrivateKey ? 'text' : 'password'}
                          value={createForm.private_key}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, private_key: e.target.value }))}
                          rows={8}
                          className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                          placeholder="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
-----END PRIVATE KEY-----"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPrivateKey(!showPrivateKey)}
                          className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600"
                        >
                          {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Auto-renew Option */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="auto-renew"
                    checked={createForm.auto_renew}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, auto_renew: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="auto-renew" className="ml-2 text-sm text-gray-700">
                    Enable automatic renewal (recommended)
                  </label>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCertificate}
                  disabled={!createForm.domain}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Certificate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Certificate Modal */}
        {viewModal.isOpen && viewModal.certificate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Certificate Details - {viewModal.certificate.domain_name}
                </h2>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <div className="flex items-center">
                      {getStatusIcon(viewModal.certificate.status)}
                      <span className="ml-2 capitalize">{viewModal.certificate.status}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issuer</label>
                    <p className="text-gray-900">{viewModal.certificate.issuer}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issued Date</label>
                    <p className="text-gray-900">{formatDate(viewModal.certificate.issued_at)}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                    <p className="text-gray-900">{formatDate(viewModal.certificate.expires_at)}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Auto-renewal</label>
                    <p className="text-gray-900">{viewModal.certificate.auto_renew ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Days Until Expiry</label>
                    <p className="text-gray-900">
                      {getDaysUntilExpiry(viewModal.certificate.expires_at) || 'N/A'}
                    </p>
                  </div>
                </div>
                
                {viewModal.certificate.certificate_data && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Certificate Data</label>
                    <textarea
                      value={viewModal.certificate.certificate_data}
                      readOnly
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                    />
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setViewModal({ isOpen: false, certificate: null })}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, certificate: null, loading: false })}
          onConfirm={confirmDeleteCertificate}
          title="Delete SSL Certificate"
          message={
            deleteModal.certificate 
              ? `Are you sure you want to delete the SSL certificate for "${deleteModal.certificate.domain?.name}"? This will make the website insecure.`
              : 'Are you sure you want to delete this SSL certificate?'
          }
          confirmText="Delete Certificate"
          type="danger"
          loading={deleteModal.loading}
        />
      </div>
    </>
  )
}
