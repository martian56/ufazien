import { useState, useEffect, useContext, createContext } from 'react'
import { hostingApi, subscriptionHelpers } from '../utils/hostingApi.js'

// Create Subscription Context
const SubscriptionContext = createContext(null)

// Custom hook to use subscription context
export const useSubscription = () => {
  const context = useContext(SubscriptionContext)
  if (!context) {
    // Fallback for backward compatibility
    return useLegacySubscription()
  }
  return context
}

// Legacy subscription hook for backward compatibility
const useLegacySubscription = () => {
  const [subscription, setSubscription] = useState({
    plan: 'Free',
    price: 0,
    limits: {
      websites: 5,
      databases: 5,
      storage: 1024,
      bandwidth: 10240
    }
  })

  const [usage, setUsage] = useState({
    websites: 3,
    databases: 2,
    storage: 400,
    bandwidth: 2100
  })

  const planDetails = {
    'Free': {
      price: 0,
      limits: {
        websites: 5,
        databases: 5,
        storage: 1024,
        bandwidth: 10240
      }
    },
    'Developer': {
      price: 5,
      limits: {
        websites: 10,
        databases: 10,
        storage: 10240,
        bandwidth: 102400
      }
    },
    'Pro': {
      price: 10,
      limits: {
        websites: 25,
        databases: 25,
        storage: 51200,
        bandwidth: 512000
      }
    }
  }

  const checkLimit = (resource) => {
    const currentUsage = usage[resource]
    const limit = subscription.limits[resource]
    return {
      current: currentUsage,
      total: limit,
      percentage: (currentUsage / limit) * 100,
      isNearLimit: (currentUsage / limit) >= 0.8,
      isAtLimit: currentUsage >= limit,
      remaining: limit - currentUsage
    }
  }

  const canCreate = (resource) => {
    const check = checkLimit(resource)
    return !check.isAtLimit
  }

  const shouldShowUpgradePrompt = (resource) => {
    const check = checkLimit(resource)
    return subscription.plan === 'Free' && (check.isNearLimit || check.isAtLimit)
  }

  const upgradePlan = (newPlan) => {
    const planData = planDetails[newPlan]
    setSubscription({
      plan: newPlan,
      price: planData.price,
      limits: planData.limits
    })
  }

  const incrementUsage = (resource, amount = 1) => {
    setUsage(prev => ({
      ...prev,
      [resource]: prev[resource] + amount
    }))
  }

  return {
    subscription,
    usage,
    checkLimit,
    canCreate,
    shouldShowUpgradePrompt,
    upgradePlan,
    incrementUsage,
    planDetails
  }
}

// Subscription Provider Component
export const SubscriptionProvider = ({ children }) => {
  const [subscription, setSubscription] = useState(null)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch user subscription and plans
  const fetchSubscriptionData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [userSub, availablePlans] = await Promise.all([
        hostingApi.getUserSubscription(),
        hostingApi.getSubscriptionPlans(),
      ])
      
      setSubscription(userSub)
      setPlans(availablePlans)
    } catch (err) {
      setError(err.message)
      console.error('Failed to fetch subscription data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Upgrade subscription
  const upgradeSubscription = async (planId) => {
    try {
      setLoading(true)
      const updatedSubscription = await hostingApi.upgradeSubscription(planId)
      setSubscription(updatedSubscription)
      return updatedSubscription
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Check if user can perform actions
  const canCreateWebsite = (currentWebsites = []) => {
    return subscriptionHelpers.canCreateWebsite(subscription, currentWebsites)
  }

  const canCreateDatabase = (currentDatabases = []) => {
    return subscriptionHelpers.canCreateDatabase(subscription, currentDatabases)
  }

  const getStorageUsage = () => {
    return {
      percentage: subscriptionHelpers.getStorageUsagePercentage(subscription),
      used: subscriptionHelpers.formatStorage(subscription?.storage_used_mb || 0),
      limit: subscriptionHelpers.formatStorage(subscription?.plan?.storage_limit_mb || 0),
    }
  }

  const getBandwidthUsage = () => {
    return {
      percentage: subscriptionHelpers.getBandwidthUsagePercentage(subscription),
      used: subscriptionHelpers.formatStorage(subscription?.bandwidth_used_mb || 0),
      limit: subscriptionHelpers.formatStorage(subscription?.plan?.bandwidth_limit_mb || 0),
    }
  }

  const hasFeature = (feature) => {
    return subscriptionHelpers.hasFeature(subscription, feature)
  }

  const getPlanColor = () => {
    return subscriptionHelpers.getPlanColor(subscription?.plan?.name)
  }

  // Initialize on mount
  useEffect(() => {
    fetchSubscriptionData()
  }, [])

  const value = {
    // State
    subscription,
    plans,
    loading,
    error,
    
    // Actions
    refreshSubscription: fetchSubscriptionData,
    upgradeSubscription,
    
    // Helpers
    canCreateWebsite,
    canCreateDatabase,
    getStorageUsage,
    getBandwidthUsage,
    hasFeature,
    getPlanColor,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

// Custom hook for managing resources with subscription limits
export const useResourceLimit = (resourceType, currentResources = []) => {
  const { subscription, canCreateWebsite, canCreateDatabase } = useSubscription()
  
  const canCreate = () => {
    switch (resourceType) {
      case 'website':
        return canCreateWebsite(currentResources)
      case 'database':
        return canCreateDatabase(currentResources)
      default:
        return false
    }
  }

  const getLimit = () => {
    switch (resourceType) {
      case 'website':
        return subscription?.plan?.max_websites || 0
      case 'database':
        return subscription?.plan?.max_databases || 0
      default:
        return 0
    }
  }

  const getCurrentCount = () => currentResources.length
  
  const getRemainingCount = () => getLimit() - getCurrentCount()

  return {
    canCreate: canCreate(),
    limit: getLimit(),
    current: getCurrentCount(),
    remaining: getRemainingCount(),
    percentage: getLimit() > 0 ? Math.round((getCurrentCount() / getLimit()) * 100) : 0,
  }
}
