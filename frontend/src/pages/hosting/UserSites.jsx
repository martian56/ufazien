import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { ExternalLink, Globe, Search, X, Tag, Menu, ChevronDown } from 'lucide-react'
import SideBar from '../../components/ui/SideBar'
import { api } from '../../lib/api/client'

export default function UserSites() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [lastQuery, setLastQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState('-total_visits') // Default: most visited first

  // Debounced load for search
  const buildQuery = (search, page, page_size, ordering) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (page) params.set('page', page)
    if (page_size) params.set('page_size', page_size)
    if (ordering) params.set('ordering', ordering)
    const s = params.toString()
    return s ? `?${s}` : ''
  }

  const load = async (search = '', page = 1, page_size = 20, ordering = sortBy) => {
    setLoading(true); setError(null)
    const q = buildQuery(search, page, page_size, ordering)
    setLastQuery(q || '/')
    try {
      // The hand-rolled content-type and JSON guards here were defending
      // against index.html coming back from a proxy. The client returns the
      // body as text in that case, so one check is enough.
      const data = await api.get(`/hosting/public/websites/${q}`)
      if (typeof data === 'string') {
        throw new Error(`Expected JSON but the server returned: ${data.slice(0, 300)}`)
      }

      // Support paginated DRF responses { results: [...], count, next, previous }
      if (Array.isArray(data)) {
        setSites(data)
        setTotalCount(data.length)
        setTotalPages(1)
      } else if (data && Array.isArray(data.results)) {
        setSites(data.results)
        setTotalCount(data.count || 0)
        const ps = page_size || pageSize
        setTotalPages(data.count ? Math.max(1, Math.ceil(data.count / ps)) : 1)
      } else {
        setSites([])
        setTotalCount(0)
        setTotalPages(1)
      }
      console.debug('Search result count:', Array.isArray(data) ? data.length : (data && Array.isArray(data.results) ? data.results.length : 0))
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let t = null
    // Reset to first page when search term changes
    setCurrentPage(1)
    const s = searchTerm ? searchTerm : ''
    t = setTimeout(() => load(s, 1, pageSize, sortBy), 300)
    return () => clearTimeout(t)
  }, [searchTerm, sortBy])

  // Reload when page or pageSize changes
  useEffect(() => {
    const s = searchTerm ? searchTerm : ''
    load(s, currentPage, pageSize, sortBy)
  }, [currentPage, pageSize])

  const formatDate = (s) => {
    try {
      return s ? new Date(s).toISOString().slice(0,10) : '-'
    } catch (e) { return '-' }
  }
  const siteUrl = (site) => {
    if (!site) return '#'
    if (site.domain) return `https://${site.domain}`
    return `https://${(site.name || '').toLowerCase()}.ufazien.com`
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sites...</p>
        </div>
      )
    }
    if (error) {
      return (
        <div className="text-center py-12">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl">!</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading sites</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Try Again</button>
        </div>
      )
    }
    if (!sites || sites.length === 0) {
      return (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sites found</h3>
          <p className="text-gray-600">There are no publicly listed websites matching your search.</p>
        </div>
      )
    }

    return (
      <>
        {/* <div className="mb-4 text-sm text-gray-500">Searching: <span className="font-medium">{lastQuery}</span> — Results: <span className="font-medium">{totalCount}</span></div> */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map(site => (
            <div key={site.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 rounded-lg p-2"><Globe className="h-5 w-5 text-blue-600" /></div>
                    <div>
                      <div className="font-semibold text-gray-900">{site.name}</div>
                      <div className="text-sm text-gray-500">{site.domain || `${(site.name || '').toLowerCase()}.ufazien.com`}</div>
                      <div className="text-xs text-gray-400 mt-1">By: {site.creator || site.owner?.username || 'unknown'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${site.website_type === 'php' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>{site.website_type}</span>
                    <a href={siteUrl(site)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-1 border rounded text-sm text-gray-700 hover:bg-gray-50">
                      <ExternalLink className="w-4 h-4 mr-1" /> Visit
                    </a>
                  </div>
                </div>

                {site.description && <p className="text-sm text-gray-600 mb-3">{site.description}</p>}

                <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                  <div>Visits: <span className="text-gray-800 ml-1">{(site.total_visits || 0).toLocaleString()}</span></div>
                  <div>Storage: <span className="text-gray-800 ml-1">{(site.storage_used_mb || 0)} MB</span></div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    <div>{site.status}</div>
                  </div>
                  <div>Created: {formatDate(site.created_at)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination controls */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">Showing page {currentPage} of {totalPages} — {totalCount} results</div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Previous</button>

            <div className="hidden sm:flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) pageNum = i + 1
                else if (currentPage <= 3) pageNum = i + 1
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
                else pageNum = currentPage - 2 + i
                if (pageNum < 1 || pageNum > totalPages) return null
                return (
                  <button key={pageNum} onClick={() => setCurrentPage(pageNum)} disabled={currentPage === pageNum} className={`px-3 py-2 text-sm rounded-md transition-colors ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      </>
    )
  }
  return (
    <>
      <Helmet>
        <title>Sites | Ufazien</title>
        <meta name="description" content="Browse websites on the platform" />
      </Helmet>

      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <SideBar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} pageTitle="User Sites" />

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 rounded-md hover:bg-gray-100">
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
                  <p className="text-sm text-gray-500">Browse publicly listed websites on the platform</p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="mb-6 flex items-center justify-between">
                <div className="w-72 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    value={searchTerm}
                    onChange={(e)=>setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        // Trigger immediate search on Enter: reset to page 1
                        load(searchTerm || '', 1, pageSize, sortBy)
                      }
                    }}
                    placeholder="Search sites..."
                    className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Sort by:</span>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(e.target.value)
                        setCurrentPage(1) // Reset to first page when sorting changes
                      }}
                      className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="-total_visits">Most Visited</option>
                      <option value="total_visits">Least Visited</option>
                      <option value="-created_at">Newest First</option>
                      <option value="created_at">Oldest First</option>
                      <option value="name">Name A-Z</option>
                      <option value="-name">Name Z-A</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                  </div>
                </div>
              </div>

              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
