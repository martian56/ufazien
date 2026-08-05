import { useEffect, useState } from 'react'
import { api } from './api/client'
import { isAuthenticated } from './api/tokens'
import type { User } from './api/types'

/**
 * The signed-in user.
 *
 * Several pages were each fetching this themselves, and two of them did it with
 * a relative fetch to an endpoint that does not exist. One place instead.
 *
 * Cached at module scope so moving between pages does not refetch on every
 * mount; the identity does not change within a session.
 */
let cached: User | null = null

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (cached || !isAuthenticated()) {
      setLoading(false)
      return
    }

    let active = true
    api
      .get<User>('/auth/user/me/')
      .then((data) => {
        cached = data
        if (active) setUser(data)
      })
      .catch(() => {
        // Not fatal: the page decides what to do without an identity.
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { user, loading }
}

/** Clear the cache, for sign out. */
export function forgetCurrentUser() {
  cached = null
}
