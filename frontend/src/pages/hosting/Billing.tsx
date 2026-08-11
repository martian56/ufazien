import { useState, useEffect } from "react"
import { errorMessage } from "../../lib/api/errors"
/** Mirrors InvoiceSerializer. */
interface Invoice {
  id: number
  invoice_number?: string
  description?: string
  amount?: number | string
  status?: string
  date?: string
  created_at?: string
}
import { Helmet } from "react-helmet"
import { useNavigate } from "react-router-dom"
import {
  CreditCard,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  Edit,
  Trash2,
  Crown,
  ArrowUpRight
} from "lucide-react"
import HostingSidebar from "../../components/hosting/HostingSidebar"
import { useSubscription } from "../../hooks/useSubscription"
import { useWebsites } from "../../hooks/useWebsites.js"
import { useDatabases } from "../../hooks/useDatabases.js"
import { hostingApi } from "../../utils/hostingApi"
import { useDialogs } from "../../components/ui/Dialogs"

export default function Billing() {
  const { toast, confirm } = useDialogs()
  const navigate = useNavigate()
  const { subscription, getStorageUsage, getBandwidthUsage, loading: subLoading } = useSubscription()
  const { websites, loading: websitesLoading } = useWebsites()
  const { databases, loading: databasesLoading } = useDatabases()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Load billing data
  useEffect(() => {
    const loadBillingData = async () => {
      try {
        setLoading(true)
        setInvoicesLoading(true)
        setError(null)
        
        // Fetch invoices directly from API
        const invoicesData = await hostingApi.getInvoices() as Invoice[] | { results?: Invoice[] }
        setInvoices(Array.isArray(invoicesData) ? invoicesData : invoicesData?.results ?? [])
        setDataLoaded(true)
        
      } catch (err) {
        setError(errorMessage(err, 'Failed to load billing data'))
      } finally {
        setLoading(false)
        setInvoicesLoading(false)
      }
    }

    // Only load when subscription data is available and we haven't loaded data yet
    if (subscription && !subLoading && !dataLoaded) {
      loadBillingData()
    } else if (subscription && !subLoading && dataLoaded) {
      // If subscription is loaded and data is already loaded, just set loading to false
      setLoading(false)
    }
  }, [subscription, subLoading, dataLoaded])

  // Calculate next billing date
  const getNextBillingDate = () => {
    if (subscription?.next_billing_date) {
      return subscription.next_billing_date
    }
    
    // Fallback: calculate based on current date + 1 month
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    return nextMonth.toISOString()
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const downloadInvoice = async (invoiceId: number) => {
    try {
      // This would call the API to download the invoice
      // await hostingApi.downloadInvoice(invoiceId)
      toast.info('Invoice downloads are not built yet.')
    } catch (err) {
      console.error('Failed to download invoice:', err)
      toast.error('Could not download that invoice.')
    }
  }

  const isLoading = subLoading || websitesLoading || databasesLoading || loading

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Billing | Ufazien Hosting</title>
          <meta name="description" content="Manage your billing and subscriptions" />
        </Helmet>
        <div className="min-h-screen bg-white">
          <HostingSidebar />
          <div className="lg:ml-64">
            <div className="p-4 lg:p-6 pt-16 lg:pt-6">
              <div className="animate-pulse space-y-6">
                <div className="h-8 bg-gray-300 rounded w-1/4"></div>
                <div className="h-32 bg-gray-300 rounded"></div>
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
          <title>Billing | Ufazien Hosting</title>
          <meta name="description" content="Manage your billing and subscriptions" />
        </Helmet>
        <div className="min-h-screen bg-white">
          <HostingSidebar />
          <div className="lg:ml-64">
            <div className="p-4 lg:p-6 pt-16 lg:pt-6">
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load billing data</h3>
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
        <title>Billing | Ufazien Hosting</title>
        <meta name="description" content="Manage your billing and subscriptions" />
      </Helmet>
      <div className="min-h-screen bg-white">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">{/* Added top padding for mobile menu button */}
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-gray-100 rounded-lg p-2">
                  <CreditCard className="h-6 w-6 text-gray-700" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
                  <p className="mt-2 text-gray-600">Manage your billing and subscriptions</p>
                </div>
              </div>
            </div>

            {/* Subscription Overview */}
            {subscription?.plan?.name !== 'free' && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="w-5 h-5 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900">Active Subscription</h3>
                    </div>
                    <p className="text-gray-600">
                      You're currently on the <strong>{subscription?.plan?.display_name || subscription?.plan?.name}</strong> plan
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Next billing: {formatDate(getNextBillingDate())} • ${subscription?.plan?.price || 0}/month
                    </p>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => navigate('/hosting/upgrade')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      Manage Plan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {subscription?.plan?.name === 'free' && (
              <div className="bg-amber-50 rounded-lg border border-amber-200 p-6 mb-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-amber-900 mb-2">Free Plan</h3>
                    <p className="text-amber-800">
                      You're using our free hosting plan with basic features
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Upgrade to unlock more websites, databases, and storage
                    </p>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => navigate('/hosting/upgrade')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      <Crown className="w-4 h-4" />
                      Upgrade Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Current Plan & Usage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Current Plan</h3>
                  {subscription?.plan?.name !== 'free' && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <Crown className="w-4 h-4" />
                      <span className="text-sm font-medium">Premium</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Plan</span>
                    <span className="font-medium text-blue-600">{subscription?.plan?.display_name || subscription?.plan?.name || 'Free'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Billing Period</span>
                    <span className="font-medium capitalize">Monthly</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Current Charge</span>
                    <span className="font-medium">
                      {(subscription?.plan?.price || 0) === 0 ? 'Free' : `$${subscription?.plan?.price || 0}`}
                    </span>
                  </div>
                  {subscription?.plan?.name !== 'free' && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Next Billing</span>
                      <span className="font-medium">{formatDate(getNextBillingDate())}</span>
                    </div>
                  )}
                  <div className="pt-4 border-t">
                    {subscription?.plan?.name === 'free' ? (
                      <button 
                        onClick={() => navigate('/hosting/upgrade')}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Crown className="w-4 h-4" />
                        Upgrade Plan
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <button 
                          onClick={() => navigate('/hosting/upgrade')}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                          Change Plan
                        </button>
                        <button className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                          Cancel Subscription
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Websites</span>
                    <span className="font-medium">{websites?.length || 0}/{subscription?.plan?.max_websites || 5}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${Math.min(((websites?.length || 0) / (subscription?.plan?.max_websites || 1)) * 100, 100)}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Databases</span>
                    <span className="font-medium">{databases?.length || 0}/{subscription?.plan?.max_databases || 5}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${Math.min(((databases?.length || 0) / (subscription?.plan?.max_databases || 1)) * 100, 100)}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Storage</span>
                    <span className="font-medium">{getStorageUsage()?.used || '0 MB'}/{getStorageUsage()?.limit || '1.0 GB'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full" 
                      style={{ width: `${getStorageUsage()?.percentage || 0}%` }}
                    ></div>
                  </div>

                  {subscription?.plan?.name === 'free' && (
                    <div className="pt-4 border-t">
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">Free Plan Limits</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Upgrade to get more websites, databases, and storage.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Invoice History */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Invoice History</h3>
                <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  <Download className="w-4 h-4 mr-2" />
                  Download All
                </button>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Invoice
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoicesLoading ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="animate-pulse">
                              <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                  <div key={i} className="flex space-x-4">
                                    <div className="h-4 bg-gray-300 rounded w-1/6"></div>
                                    <div className="h-4 bg-gray-300 rounded w-1/6"></div>
                                    <div className="h-4 bg-gray-300 rounded w-2/6"></div>
                                    <div className="h-4 bg-gray-300 rounded w-1/6"></div>
                                    <div className="h-4 bg-gray-300 rounded w-1/6"></div>
                                    <div className="h-4 bg-gray-300 rounded w-1/6"></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : invoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
                            <p className="text-gray-600">Your billing history will appear here</p>
                          </td>
                        </tr>
                      ) : (
                        invoices.map((invoice) => (
                          <tr key={invoice.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {invoice.invoice_number || invoice.id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {formatDate(invoice.created_at || invoice.date)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {invoice.description || `${subscription?.plan?.display_name || 'Hosting'} Plan`}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              ${invoice.amount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-1">
                                {getStatusIcon(invoice.status)}
                                <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(invoice.status)}`}>
                                  {(invoice.status ?? "").charAt(0).toUpperCase() + (invoice.status ?? "").slice(1)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <button 
                                onClick={() => downloadInvoice(invoice.id)}
                                className="inline-flex items-center text-blue-600 hover:text-blue-800"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Billing Summary Cards */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="text-sm text-gray-500">This Month</div>
                    <div className="text-lg font-semibold">${subscription?.plan?.price || 0}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="text-sm text-gray-500">Total Invoices</div>
                    <div className="text-lg font-semibold">{invoices.length}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-purple-500" />
                  <div>
                    <div className="text-sm text-gray-500">Next Billing</div>
                    <div className="text-lg font-semibold">{formatDate(getNextBillingDate())}</div>
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
