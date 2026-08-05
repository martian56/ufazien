import { useState, useEffect } from 'react'
import { hostingApi } from '../utils/hostingApi'

const ApiTest = () => {
  const [status, setStatus] = useState('Testing API connection...')
  const [results, setResults] = useState({})

  useEffect(() => {
    const testApi = async () => {
      try {
        // Test subscription plans endpoint (public)
        const plans = await hostingApi.getSubscriptionPlans()
        setResults(prev => ({ ...prev, plans: `✅ Found ${plans.length} subscription plans` }))

        // Test dashboard stats (requires auth)
        try {
          const stats = await hostingApi.getDashboardStats()
          setResults(prev => ({ ...prev, stats: `✅ Dashboard stats loaded` }))
        } catch (authError) {
          setResults(prev => ({ ...prev, stats: `⚠️ Dashboard stats requires authentication: ${authError.message}` }))
        }

        // Test websites endpoint (requires auth) 
        try {
          const websites = await hostingApi.getWebsites()
          setResults(prev => ({ ...prev, websites: `✅ Found ${websites.length || 0} websites` }))
        } catch (authError) {
          setResults(prev => ({ ...prev, websites: `⚠️ Websites endpoint requires authentication: ${authError.message}` }))
        }

        setStatus('API tests completed')
      } catch (error) {
        setStatus(`❌ API test failed: ${error.message}`)
      }
    }

    testApi()
  }, [])

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">API Integration Test</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="font-medium mb-4">{status}</p>
          <div className="space-y-2">
            {Object.entries(results).map(([key, value]) => (
              <div key={key} className="text-sm">
                <strong>{key}:</strong> {value}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600">
              Backend URL: {import.meta.env.VITE_API_URL}/api
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApiTest
