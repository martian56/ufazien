import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { api } from "../../lib/api/client"
import { getAccessToken } from "../../lib/api/tokens"

export default function ProtectedRoute({ children }) {
  const [checked, setChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const checkAuth = async () => {
      if (!getAccessToken()) {
        setChecked(true)
        setAuthenticated(false)
        return
      }
      try {
        // This used to hand-roll the refresh dance in axios: catch the 401,
        // post to the refresh endpoint, store the token, retry. The client
        // does exactly that, and shares one refresh across concurrent calls.
        await api.get("/auth/user/me/")
        setAuthenticated(true)
      } catch {
        setAuthenticated(false)
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
