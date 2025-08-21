import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../utils/hostingApi.js'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access')
      if (token) {
        try {
          const userProfile = await authApi.getProfile()
          setUser(userProfile)
          setIsAuthenticated(true)
        } catch (error) {
          console.error('Auth check failed:', error)
          // Token might be expired, remove it
          localStorage.removeItem('access')
          localStorage.removeItem('refresh')
          setIsAuthenticated(false)
        }
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (credentials) => {
    try {
      const response = await authApi.login(credentials)
      if (response.user) {
        setUser(response.user)
        setIsAuthenticated(true)
      }
      return response
    } catch (error) {
      throw error
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      setIsAuthenticated(false)
    }
  }

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
