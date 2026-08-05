import { useCallback, useEffect, useState } from 'react'
import { hostingApi, type DashboardStats } from '../utils/hostingApi'
import { errorMessage } from '../lib/api/errors'

/** Analytics cached per website id (and under "bandwidth"), then per period. */
type AnalyticsCache = Record<string, Record<string, unknown>>

export const useDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsCache>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch dashboard statistics
  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setStats(await hostingApi.getDashboardStats())
    } catch (err) {
      setError(errorMessage(err, 'Failed to fetch dashboard stats'))
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch analytics for a specific website
  const fetchWebsiteAnalytics = async (websiteId: string, period = '7d') => {
    const data = await hostingApi.getWebsiteAnalytics(websiteId, period)
    setAnalytics((prev) => ({
      ...prev,
      [websiteId]: { ...prev[websiteId], [period]: data },
    }))
    return data
  }

  // Fetch bandwidth usage
  const fetchBandwidthUsage = async (period = '30d') => {
    const data = await hostingApi.getBandwidthUsage(period)
    setAnalytics((prev) => ({
      ...prev,
      bandwidth: { ...prev.bandwidth, [period]: data },
    }))
    return data
  }

  // Get activity log
  const fetchActivityLog = () => hostingApi.getActivityLog()

  // Get invoices
  const fetchInvoices = () => hostingApi.getInvoices()

  // Initialize on mount
  useEffect(() => {
    fetchDashboardStats()
  }, [fetchDashboardStats])

  // Helper functions for chart data formatting
  const formatChartData = (data: unknown, key: string) => {
    if (!data || !Array.isArray(data)) return []

    return (data as Record<string, unknown>[]).map((item) => ({
      ...item,
      date: new Date(String(item.date)).toLocaleDateString(),
      value: item[key] ?? 0,
    }))
  }

  const getWebsiteAnalytics = (websiteId: string, period = '7d') =>
    analytics[websiteId]?.[period] ?? null

  const getBandwidthAnalytics = (period = '30d') => analytics.bandwidth?.[period] ?? null

  return {
    // State
    stats,
    analytics,
    loading,
    error,

    // Actions
    fetchDashboardStats,
    fetchWebsiteAnalytics,
    fetchBandwidthUsage,
    fetchActivityLog,
    fetchInvoices,

    // Helpers
    formatChartData,
    getWebsiteAnalytics,
    getBandwidthAnalytics,
  }
}

export default useDashboard
