import { useState } from "react"
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

export default function Upgrade() {
  const [selectedPlan, setSelectedPlan] = useState("developer")
  const [billingPeriod, setBillingPeriod] = useState("monthly")

  const plans = [
    {
      id: "free",
      name: "Free",
      price: 0,
      yearlyPrice: 0,
      description: "Perfect for getting started",
      popular: false,
      features: {
        websites: 5,
        databases: 5,
        storage: "1 GB",
        bandwidth: "10 GB",
        ssl: true,
        support: "Community",
        domains: 1,
        backups: false,
        analytics: "Basic"
      },
      limitations: [
        "Limited to 5 websites",
        "Basic analytics only",
        "Community support",
        "No automated backups"
      ]
    },
    {
      id: "developer",
      name: "Developer",
      price: 5,
      yearlyPrice: 50,
      description: "Great for developers and small projects",
      popular: true,
      features: {
        websites: 10,
        databases: 10,
        storage: "10 GB",
        bandwidth: "100 GB",
        ssl: true,
        support: "Email",
        domains: 3,
        backups: true,
        analytics: "Advanced"
      },
      benefits: [
        "Double the websites & databases",
        "10x more storage",
        "Email support",
        "Automated daily backups"
      ]
    },
    {
      id: "pro",
      name: "Pro",
      price: 10,
      yearlyPrice: 100,
      description: "For growing businesses and agencies",
      popular: false,
      features: {
        websites: 25,
        databases: 25,
        storage: "50 GB",
        bandwidth: "500 GB",
        ssl: true,
        support: "Priority",
        domains: 10,
        backups: true,
        analytics: "Advanced + Custom"
      },
      benefits: [
        "25 websites & databases",
        "50 GB storage space",
        "Priority support",
        "Custom analytics dashboard"
      ]
    }
  ]

  const currentPlan = "free" // This would come from user context/API

  const getPrice = (plan) => {
    if (plan.price === 0) return "Free"
    const price = billingPeriod === "yearly" ? plan.yearlyPrice : plan.price
    const period = billingPeriod === "yearly" ? "year" : "month"
    return `$${price}/${period}`
  }

  const getSavings = (plan) => {
    if (plan.price === 0 || billingPeriod === "monthly") return null
    const monthlyCost = plan.price * 12
    const savings = monthlyCost - plan.yearlyPrice
    return savings
  }

  const handleUpgrade = (planId) => {
    if (planId === "free") return
    // Handle upgrade logic here
    console.log(`Upgrading to ${planId} plan`)
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

            {/* Billing Toggle */}
            <div className="flex items-center justify-center mb-8">
              <div className="bg-white rounded-lg p-1 border border-gray-200">
                <button
                  onClick={() => setBillingPeriod("monthly")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    billingPeriod === "monthly"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingPeriod("yearly")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    billingPeriod === "yearly"
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Yearly
                  <span className="ml-1 text-xs bg-green-100 text-green-800 px-1 rounded">Save 17%</span>
                </button>
              </div>
            </div>

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
                        {billingPeriod === "yearly" && getSavings(plan) && (
                          <div className="text-sm text-green-600 font-medium">
                            Save ${getSavings(plan)} per year
                          </div>
                        )}
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

                    {/* Benefits/Limitations */}
                    {plan.benefits && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Key Benefits:</h4>
                        <ul className="space-y-1">
                          {plan.benefits.map((benefit, index) => (
                            <li key={index} className="flex items-center space-x-2 text-sm text-green-700">
                              <Check className="h-3 w-3 text-green-500" />
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {plan.limitations && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Limitations:</h4>
                        <ul className="space-y-1">
                          {plan.limitations.map((limitation, index) => (
                            <li key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                              <X className="h-3 w-3 text-gray-400" />
                              <span>{limitation}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

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
