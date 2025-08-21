import { useState, useEffect } from 'react'
import { hostingApi } from '../utils/hostingApi.js'
import { useSubscription } from './useSubscription.jsx'

export const useDatabases = () => {
  const [databases, setDatabases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { canCreateDatabase } = useSubscription()

  // Fetch databases
  const fetchDatabases = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await hostingApi.getDatabases()
      setDatabases(data.results || data)
    } catch (err) {
      setError(err.message)
      console.error('Failed to fetch databases:', err)
    } finally {
      setLoading(false)
    }
  }

  // Create database
  const createDatabase = async (databaseData) => {
    if (!canCreateDatabase(databases)) {
      throw new Error('Database limit reached. Please upgrade your plan.')
    }

    try {
      const newDatabase = await hostingApi.createDatabase(databaseData)
      setDatabases(prev => [...prev, newDatabase])
      return newDatabase
    } catch (err) {
      throw new Error(err.message || 'Failed to create database')
    }
  }

  // Update database
  const updateDatabase = async (id, databaseData) => {
    try {
      // Use specific password change endpoint if only changing password
      if (Object.keys(databaseData).length === 1 && databaseData.password) {
        await hostingApi.changeDatabasePassword(id, databaseData.password)
        // Fetch updated database data
        const updatedDatabase = await hostingApi.getDatabase(id)
        setDatabases(prev => 
          prev.map(database => 
            database.id === id ? updatedDatabase : database
          )
        )
        return updatedDatabase
      } else {
        const updatedDatabase = await hostingApi.updateDatabase(id, databaseData)
        setDatabases(prev => 
          prev.map(database => 
            database.id === id ? updatedDatabase : database
          )
        )
        return updatedDatabase
      }
    } catch (err) {
      throw new Error(err.message || 'Failed to update database')
    }
  }

  // Delete database
  const deleteDatabase = async (id) => {
    try {
      await hostingApi.deleteDatabase(id)
      setDatabases(prev => prev.filter(database => database.id !== id))
    } catch (err) {
      throw new Error(err.message || 'Failed to delete database')
    }
  }

  // Get database by ID
  const getDatabase = (id) => {
    return databases.find(database => database.id === id)
  }

  // Get databases by type
  const getDatabasesByType = (type) => {
    return databases.filter(database => database.engine === type)
  }

  // Initialize on mount
  useEffect(() => {
    fetchDatabases()
  }, [])

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
