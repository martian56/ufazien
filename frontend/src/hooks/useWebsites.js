import { useState, useEffect } from 'react'
import { hostingApi } from '../utils/hostingApi.js'
import { useSubscription } from './useSubscription.jsx'

export const useWebsites = () => {
  const [websites, setWebsites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { canCreateWebsite } = useSubscription()

  // Fetch websites
  const fetchWebsites = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await hostingApi.getWebsites()
      setWebsites(data.results || data)
    } catch (err) {
      setError(err.message)
      console.error('Failed to fetch websites:', err)
    } finally {
      setLoading(false)
    }
  }

  // Create website
  const createWebsite = async (websiteData) => {
    if (!canCreateWebsite(websites)) {
      throw new Error('Website limit reached. Please upgrade your plan.')
    }

    try {
      const newWebsite = await hostingApi.createWebsite(websiteData)
      setWebsites(prev => [...prev, newWebsite])
      return newWebsite
    } catch (err) {
      // Preserve the original error structure for better error handling
      throw err
    }
  }

  // Update website
  const updateWebsite = async (id, websiteData) => {
    try {
      const updatedWebsite = await hostingApi.updateWebsite(id, websiteData)
      setWebsites(prev => 
        prev.map(website => 
          website.id === id ? updatedWebsite : website
        )
      )
      return updatedWebsite
    } catch (err) {
      throw new Error(err.message || 'Failed to update website')
    }
  }

  // Delete website
  const deleteWebsite = async (id) => {
    try {
      await hostingApi.deleteWebsite(id)
      setWebsites(prev => prev.filter(website => website.id !== id))
    } catch (err) {
      throw new Error(err.message || 'Failed to delete website')
    }
  }

  // Deploy website
  const deployWebsite = async (id) => {
    try {
      const deployment = await hostingApi.deployWebsite(id)
      // Update website status to deploying
      setWebsites(prev => 
        prev.map(website => 
          website.id === id 
            ? { ...website, status: 'deploying' }
            : website
        )
      )
      return deployment
    } catch (err) {
      throw new Error(err.message || 'Failed to deploy website')
    }
  }

  // Get website by ID
  const getWebsite = (id) => {
    return websites.find(website => website.id === id)
  }

  // Initialize on mount
  useEffect(() => {
    fetchWebsites()
  }, [])

  return {
    websites,
    loading,
    error,
    fetchWebsites,
    createWebsite,
    updateWebsite,
    deleteWebsite,
    deployWebsite,
    getWebsite,
    canCreate: canCreateWebsite(websites),
  }
}

export default useWebsites
