import { useState, useEffect } from 'react'
import { hostingApi } from '../utils/hostingApi.js'

export const useDashboard = () => {
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await hostingApi.getDashboardStats()
      setStats(data)
    } catch (err) {
      setError(err.message)
      console.error('Failed to fetch dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch analytics for a specific website
  const fetchWebsiteAnalytics = async (websiteId, period = '7d') => {
    try {
      const data = await hostingApi.getWebsiteAnalytics(websiteId, period)
      setAnalytics(prev => ({
        ...prev,
        [websiteId]: {
          ...prev[websiteId],
          [period]: data
        }
      }))
      return data
    } catch (err) {
      console.error('Failed to fetch website analytics:', err)
      throw err
    }
  }

  // Fetch bandwidth usage
  const fetchBandwidthUsage = async (period = '30d') => {
    try {
      const data = await hostingApi.getBandwidthUsage(period)
      setAnalytics(prev => ({
        ...prev,
        bandwidth: {
          ...prev.bandwidth,
          [period]: data
        }
      }))
      return data
    } catch (err) {
      console.error('Failed to fetch bandwidth usage:', err)
      throw err
    }
  }

  // Get activity log
  const fetchActivityLog = async () => {
    try {
      const data = await hostingApi.getActivityLog()
      return data
    } catch (err) {
      console.error('Failed to fetch activity log:', err)
      throw err
    }
  }

  // Get invoices
  const fetchInvoices = async () => {
    try {
      const data = await hostingApi.getInvoices()
      return data
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
      throw err
    }
  }

  // Initialize on mount
  useEffect(() => {
    fetchDashboardStats()
  }, [])

  // Helper functions for chart data formatting
  const formatChartData = (data, key) => {
    if (!data || !Array.isArray(data)) return []
    
    return data.map(item => ({
      date: new Date(item.date).toLocaleDateString(),
      value: item[key] || 0,
      ...item
    }))
  }

  const getWebsiteAnalytics = (websiteId, period = '7d') => {
    return analytics[websiteId]?.[period] || null
  }

  const getBandwidthAnalytics = (period = '30d') => {
    return analytics.bandwidth?.[period] || null
  }

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
