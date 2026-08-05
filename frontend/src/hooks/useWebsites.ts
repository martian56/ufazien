import { useCallback, useEffect, useState } from 'react'
import { hostingApi, type Website } from '../utils/hostingApi'
import { toList } from '../lib/api/types'
import { errorMessage } from '../lib/api/errors'
import { useSubscription } from './useSubscription'

export const useWebsites = () => {
  const [websites, setWebsites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { canCreateWebsite } = useSubscription()

  // Fetch websites
  const fetchWebsites = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setWebsites(toList(await hostingApi.getWebsites()))
    } catch (err) {
      setError(errorMessage(err, 'Failed to fetch websites'))
    } finally {
      setLoading(false)
    }
  }, [])

  // Create website
  const createWebsite = async (websiteData: Partial<Website> & Record<string, unknown>) => {
    if (!canCreateWebsite(websites)) {
      throw new Error('Website limit reached. Please upgrade your plan.')
    }

    // No try/catch: callers inspect ApiError for field-level validation errors,
    // so rewrapping it here would throw that away.
    const newWebsite = await hostingApi.createWebsite(websiteData)
    setWebsites((prev) => [...prev, newWebsite])
    return newWebsite
  }

  // Update website
  const updateWebsite = async (id: string, websiteData: Partial<Website>) => {
    try {
      const updatedWebsite = await hostingApi.updateWebsite(id, websiteData)
      setWebsites((prev) => prev.map((website) => (website.id === id ? updatedWebsite : website)))
      return updatedWebsite
    } catch (err) {
      throw new Error(errorMessage(err, 'Failed to update website'))
    }
  }

  // Delete website
  const deleteWebsite = async (id: string) => {
    try {
      await hostingApi.deleteWebsite(id)
      setWebsites((prev) => prev.filter((website) => website.id !== id))
    } catch (err) {
      throw new Error(errorMessage(err, 'Failed to delete website'))
    }
  }

  // Deploy website
  const deployWebsite = async (id: string) => {
    try {
      const deployment = await hostingApi.deployWebsite(id)
      // Update website status to deploying
      setWebsites((prev) =>
        prev.map((website) => (website.id === id ? { ...website, status: 'deploying' } : website)),
      )
      return deployment
    } catch (err) {
      throw new Error(errorMessage(err, 'Failed to deploy website'))
    }
  }

  // Get website by ID
  const getWebsite = (id: string) => websites.find((website) => website.id === id)

  // Initialize on mount
  useEffect(() => {
    fetchWebsites()
  }, [fetchWebsites])

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
