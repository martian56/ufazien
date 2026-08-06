import { useEffect, useState } from "react"
import { hostingApi, type SubscriptionPlan } from "../../utils/hostingApi"
import { useSubscription } from "../../hooks/useSubscription"
import { Helmet } from "react-helmet"
import {
  Crown,
  Check,
  X,
  Zap,
  Globe,
  Database,
  HardDrive,
  ArrowRight,
  Star,
  Shield,
  Clock,
  Users
} from "lucide-react"
import HostingSidebar from "../../components/hosting/HostingSidebar"

/** What the page needs to draw one plan card. */
interface PlanCard {
  id: string
  name: string
  price: number
  description: string
  popular: boolean
  features: {
    websites: number
    databases: number
    storage: string
    bandwidth: string
    ssl: boolean
    support: string
    domains: number
    backups: boolean
  }
}

const formatSize = (mb?: number) => {
  if (!mb) return "0 MB"
  return mb < 1024 ? `${mb} MB` : `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
}

/**
 * Build a card from a plan the server actually offers.
 *
 * The page used to carry its own hardcoded list of four plans with invented
 * prices, feature sets and yearly discounts. It had no connection to
 * SubscriptionPlan in the database, so the plans on offer here and the plans
 * that exist could differ without anyone noticing.
 */
function toCard(plan: SubscriptionPlan): PlanCard {
  return {
    id: plan.name,
    name: plan.display_name || plan.name,
    price: Number(plan.price ?? 0),
    description:
      Number(plan.price ?? 0) === 0
        ? "Everything you need to get started"
        : `${plan.max_websites} websites and ${formatSize(plan.storage_limit_mb)} of storage`,
    popular: plan.name === "developer",
    features: {
      websites: plan.max_websites,
      databases: plan.max_databases,
      storage: formatSize(plan.storage_limit_mb),
      bandwidth: formatSize(plan.bandwidth_limit_mb),
      ssl: Boolean(plan.ssl_included),
      support: plan.priority_support ? "Priority" : "Community",
      domains: plan.custom_domains ? 5 : 1,
      backups: Boolean(plan.backup_frequency_days),
    },
  }
}

export default function Upgrade() {
  const { subscription } = useSubscription()
  const [plans, setPlans] = useState<PlanCard[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)

  useEffect(() => {
    let active = true
    hostingApi
      .getSubscriptionPlans()
      .then((data: SubscriptionPlan[] | { results?: SubscriptionPlan[] }) => {
        if (!active) return
        const list = Array.isArray(data) ? data : (data as { results?: SubscriptionPlan[] })?.results ?? []
        setPlans(list.map(toCard).sort((a, b) => a.price - b.price))
      })
      .catch(() => {
        // The page renders its empty state rather than inventing a price list.
      })
      .finally(() => {
        if (active) setLoadingPlans(false)
      })
    return () => {
      active = false
    }
  }, [])

  const currentPlan = subscription?.plan?.name ?? "free"

  const getPrice = (plan: PlanCard) => {
    if (plan.price === 0) return "Free"
    return `$${plan.price}/month`
  }

  /**
   * There is no upgrade endpoint and no payment flow: the subscription
   * viewset only reads the current plan. This button used to be
   * `// Handle upgrade logic here`, so pressing it did nothing and said
   * nothing.
   */
  const handleUpgrade = (planId: string) => {
    if (planId === currentPlan) return
    window.location.href = `/feedback?subject=${encodeURIComponent(`Upgrade to the ${planId} plan`)}`
  }

  return (
    <>
      <Helmet>
        <title>Upgrade Plan | Ufazien Hosting</title>
        <meta name="description" content="Upgrade your hosting plan for more websites, storage, and features" />
      </Helmet>
      <div className="min-h-screen bg-gray-50">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">{/* Added top padding for mobile menu button */}
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-3">
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Upgrade Your Plan</h1>
                  <p className="mt-2 text-gray-600">Choose the perfect plan for your hosting needs</p>
                </div>
              </div>
              
              {currentPlan === "free" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-2xl mx-auto">
                  <div className="flex items-center space-x-2 text-yellow-800">
                    <Zap className="h-5 w-5" />
                    <span className="font-medium">You're currently on the Free plan</span>
                  </div>
                  <p className="text-yellow-700 text-sm mt-1">
                    Upgrade to unlock more websites, storage, and premium features
                  </p>
                </div>
              )}
            </div>

            {/* A monthly/yearly toggle used to sit here, offering "Save 17%"
                on a yearly price the server does not have: SubscriptionPlan
                carries one price and no yearly figure. */}

            {/* Plans Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl shadow-sm border-2 transition-all duration-200 ${
                    plan.popular
                      ? "border-blue-500 shadow-lg scale-105"
                      : currentPlan === plan.id
                      ? "border-green-500"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                        <Star className="h-4 w-4" />
                        <span>Most Popular</span>
                      </div>
                    </div>
                  )}

                  {currentPlan === plan.id && (
                    <div className="absolute -top-4 right-4">
                      <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        Current Plan
                      </div>
                    </div>
                  )}

                  <div className="p-6">
                    {/* Plan Header */}
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                      <p className="text-gray-600 text-sm mt-1">{plan.description}</p>
                      
                      <div className="mt-4">
                        <div className="text-4xl font-bold text-gray-900">
                          {getPrice(plan)}
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4 text-blue-600" />
                          <span className="text-sm text-gray-600">Websites</span>
                        </div>
                        <span className="font-medium">{plan.features.websites}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Database className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-gray-600">Databases</span>
                        </div>
                        <span className="font-medium">{plan.features.databases}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <HardDrive className="h-4 w-4 text-purple-600" />
                          <span className="text-sm text-gray-600">Storage</span>
                        </div>
                        <span className="font-medium">{plan.features.storage}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <ArrowRight className="h-4 w-4 text-orange-600" />
                          <span className="text-sm text-gray-600">Bandwidth</span>
                        </div>
                        <span className="font-medium">{plan.features.bandwidth}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Shield className="h-4 w-4 text-indigo-600" />
                          <span className="text-sm text-gray-600">SSL Certificates</span>
                        </div>
                        <span className="font-medium">
                          {plan.features.ssl ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-cyan-600" />
                          <span className="text-sm text-gray-600">Support</span>
                        </div>
                        <span className="font-medium text-sm">{plan.features.support}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-600" />
                          <span className="text-sm text-gray-600">Backups</span>
                        </div>
                        <span className="font-medium">
                          {plan.features.backups ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </span>
                      </div>
                    </div>

                    {/* A "Key Benefits" list and a "Limitations" list used to
                        sit here, both filled from hardcoded arrays. The server
                        describes a plan by its limits, which the feature rows
                        above already show. */}

                    {/* Action Button */}
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={currentPlan === plan.id}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                        currentPlan === plan.id
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : plan.popular
                          ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                          : plan.id === "free"
                          ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {currentPlan === plan.id
                        ? "Current Plan"
                        : plan.id === "free"
                        ? "Free Plan"
                        : `Upgrade to ${plan.name}`
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* FAQ Section */}
            <div className="max-w-4xl mx-auto mt-16">
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Frequently Asked Questions</h2>
              
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="font-medium text-gray-900 mb-2">Can I change my plan later?</h3>
                  <p className="text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
                </div>
                
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="font-medium text-gray-900 mb-2">What happens to my websites if I downgrade?</h3>
                  <p className="text-gray-600">If you exceed the limits of your new plan, you'll need to remove excess websites or databases before downgrading.</p>
                </div>
                
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="font-medium text-gray-900 mb-2">Is there a free trial for paid plans?</h3>
                  <p className="text-gray-600">All paid plans come with a 7-day money-back guarantee. No questions asked.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
