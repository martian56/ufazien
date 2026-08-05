import { useCallback, useEffect, useState } from 'react'
import { hostingApi, type HostingDatabase } from '../utils/hostingApi'
import { toList } from '../lib/api/types'
import { errorMessage } from '../lib/api/errors'
import { useSubscription } from './useSubscription'

export const useDatabases = () => {
  const [databases, setDatabases] = useState<HostingDatabase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { canCreateDatabase } = useSubscription()

  // Fetch databases
  const fetchDatabases = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      // Some endpoints paginate and some return a bare array.
      setDatabases(toList(await hostingApi.getDatabases()))
    } catch (err) {
      setError(errorMessage(err, 'Failed to fetch databases'))
    } finally {
      setLoading(false)
    }
  }, [])

  // Create database
  const createDatabase = async (databaseData: Record<string, unknown>) => {
    if (!canCreateDatabase(databases)) {
      throw new Error('Database limit reached. Please upgrade your plan.')
    }

    try {
      const newDatabase = await hostingApi.createDatabase(databaseData)
      setDatabases((prev) => [...prev, newDatabase])
      return newDatabase
    } catch (err) {
      throw new Error(errorMessage(err, 'Failed to create database'))
    }
  }

  // Update database
  const updateDatabase = async (
    id: number | string,
    databaseData: Record<string, unknown> & { password?: string },
  ) => {
    try {
      const replace = (updated: HostingDatabase) =>
        setDatabases((prev) => prev.map((database) => (database.id === id ? updated : database)))

      // Use specific password change endpoint if only changing password
      if (Object.keys(databaseData).length === 1 && databaseData.password) {
        await hostingApi.changeDatabasePassword(id, databaseData.password)
        const updatedDatabase = await hostingApi.getDatabase(id)
        replace(updatedDatabase as HostingDatabase)
        return updatedDatabase
      }

      const updatedDatabase = await hostingApi.updateDatabase(id, databaseData)
      replace(updatedDatabase as HostingDatabase)
      return updatedDatabase
    } catch (err) {
      throw new Error(errorMessage(err, 'Failed to update database'))
    }
  }

  // Delete database
  const deleteDatabase = async (id: number | string) => {
    try {
      await hostingApi.deleteDatabase(id)
      setDatabases((prev) => prev.filter((database) => database.id !== id))
    } catch (err) {
      throw new Error(errorMessage(err, 'Failed to delete database'))
    }
  }

  // Get database by ID
  const getDatabase = (id: number | string) => databases.find((database) => database.id === id)

  // Get databases by type
  const getDatabasesByType = (type: string) =>
    databases.filter((database) => database.db_type === type)

  // Initialize on mount
  useEffect(() => {
    fetchDatabases()
  }, [fetchDatabases])

  return {
    databases,
    loading,
    error,
    fetchDatabases,
    createDatabase,
    updateDatabase,
    deleteDatabase,
    getDatabase,
    getDatabasesByType,
    canCreate: canCreateDatabase(databases),
  }
}

export default useDatabases
