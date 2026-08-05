import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  hostingApi,
  subscriptionHelpers,
  type SubscriptionPlan,
  type UserSubscription,
} from '../utils/hostingApi'
import { toList } from '../lib/api/types'
import { errorMessage } from '../lib/api/errors'

export interface UsageSummary {
  percentage: number
  used: string
  limit: string
}

export interface SubscriptionContextValue {
  subscription: UserSubscription | null
  plans: SubscriptionPlan[]
  loading: boolean
  error: string | null
  refreshSubscription: () => Promise<void>
  upgradeSubscription: (planName: string) => Promise<UserSubscription>
  canCreateWebsite: (currentWebsites?: unknown[]) => boolean
  canCreateDatabase: (currentDatabases?: unknown[]) => boolean
  getStorageUsage: () => UsageSummary
  getBandwidthUsage: () => UsageSummary
  hasFeature: (feature: string) => boolean
  getPlanColor: () => string
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

/**
 * There used to be a `useLegacySubscription` fallback here, returning hardcoded
 * plan limits and invented usage numbers (3 websites, 2 databases, 400MB). It
 * was called conditionally from inside this hook, which breaks the rules of
 * hooks, and it was unreachable anyway: App.jsx mounts the provider. Missing
 * provider is now a programming error rather than silently fake data.
 */
export const useSubscription = (): SubscriptionContextValue => {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider')
  }
  return context
}

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch user subscription and plans
  const fetchSubscriptionData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [userSub, availablePlans] = await Promise.all([
        hostingApi.getUserSubscription(),
        hostingApi.getSubscriptionPlans(),
      ])

      setSubscription(userSub)
      setPlans(toList(availablePlans))
    } catch (err) {
      setError(errorMessage(err, 'Failed to fetch subscription data'))
    } finally {
      setLoading(false)
    }
  }, [])

  // Upgrade subscription
  const upgradeSubscription = useCallback(async (planName: string) => {
    try {
      setLoading(true)
      const updated = (await hostingApi.upgradeSubscription(planName)) as UserSubscription
      setSubscription(updated)
      return updated
    } catch (err) {
      setError(errorMessage(err, 'Failed to upgrade subscription'))
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubscriptionData()
  }, [fetchSubscriptionData])

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscription,
      plans,
      loading,
      error,

      refreshSubscription: fetchSubscriptionData,
      upgradeSubscription,

      canCreateWebsite: (currentWebsites: unknown[] = []) =>
        subscriptionHelpers.canCreateWebsite(subscription, currentWebsites),
      canCreateDatabase: (currentDatabases: unknown[] = []) =>
        subscriptionHelpers.canCreateDatabase(subscription, currentDatabases),
      getStorageUsage: () => ({
        percentage: subscriptionHelpers.getStorageUsagePercentage(subscription),
        used: subscriptionHelpers.formatStorage(subscription?.storage_used_mb || 0),
        limit: subscriptionHelpers.formatStorage(subscription?.plan?.storage_limit_mb || 0),
      }),
      getBandwidthUsage: () => ({
        percentage: subscriptionHelpers.getBandwidthUsagePercentage(subscription),
        used: subscriptionHelpers.formatStorage(subscription?.bandwidth_used_mb || 0),
        limit: subscriptionHelpers.formatStorage(subscription?.plan?.bandwidth_limit_mb || 0),
      }),
      hasFeature: (feature: string) => subscriptionHelpers.hasFeature(subscription, feature),
      getPlanColor: () => subscriptionHelpers.getPlanColor(subscription?.plan?.name),
    }),
    [subscription, plans, loading, error, fetchSubscriptionData, upgradeSubscription],
  )

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}

export type ResourceType = 'website' | 'database'

// Custom hook for managing resources with subscription limits
export const useResourceLimit = (resourceType: ResourceType, currentResources: unknown[] = []) => {
  const { subscription, canCreateWebsite, canCreateDatabase } = useSubscription()

  const canCreate =
    resourceType === 'website'
      ? canCreateWebsite(currentResources)
      : resourceType === 'database'
        ? canCreateDatabase(currentResources)
        : false

  const limit =
    resourceType === 'website'
      ? subscription?.plan?.max_websites || 0
      : resourceType === 'database'
        ? subscription?.plan?.max_databases || 0
        : 0

  const current = currentResources.length

  return {
    canCreate,
    limit,
    current,
    remaining: limit - current,
    percentage: limit > 0 ? Math.round((current / limit) * 100) : 0,
  }
}
