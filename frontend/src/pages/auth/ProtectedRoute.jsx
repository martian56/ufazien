import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL

const API_PROFILE = `${API_URL}/api/auth/user/me/`
const API_REFRESH = `${API_URL}/api/auth/token/refresh/`

export default function ProtectedRoute({ children }) {
  const [checked, setChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const checkAuth = async () => {
      const access = localStorage.getItem("access")
      const refresh = localStorage.getItem("refresh")
      if (!access) {
        setChecked(true)
        setAuthenticated(false)
        return
      }
      try {
        await axios.get(API_PROFILE, {
          headers: { Authorization: `Bearer ${access}` },
        })
        setAuthenticated(true)
      } catch (err) {
        // If token expired, try refresh
        if (err.response?.status === 401 && refresh) {
          try {
            const refreshRes = await axios.post(API_REFRESH, { refresh })
            localStorage.setItem("access", refreshRes.data.access)
            // Retry profile fetch with new token
            await axios.get(API_PROFILE, {
              headers: { Authorization: `Bearer ${refreshRes.data.access}` },
            })
            setAuthenticated(true)
          } catch {
            setAuthenticated(false)
          }
        } else {
          setAuthenticated(false)
        }
      } finally {
        setChecked(true)
      }
    }
    checkAuth()
  }, [])

  if (!checked) return <div></div>
  if (!authenticated) {
    const redirectPath = `${location.pathname}${location.search}`
    return <Navigate to={`/auth?redirect=${encodeURIComponent(redirectPath)}`} replace />
  }
  return children
}