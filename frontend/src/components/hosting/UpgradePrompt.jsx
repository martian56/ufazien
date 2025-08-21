import { Crown, ArrowRight, X } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function UpgradePrompt({ 
  isVisible, 
  onClose, 
  title, 
  description, 
  currentUsage, 
  limit, 
  feature 
}) {
  const navigate = useNavigate()

  if (!isVisible) return null

  const usagePercentage = (currentUsage / limit) * 100

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-6">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-3 w-16 h-16 mx-auto mb-4">
            <Crown className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600">{description}</p>
        </div>

        {/* Usage Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{feature} Usage</span>
            <span>{currentUsage} of {limit}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full ${
                usagePercentage >= 100 
                  ? 'bg-red-500' 
                  : usagePercentage >= 80 
                  ? 'bg-yellow-500' 
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            ></div>
          </div>
          {usagePercentage >= 100 && (
            <p className="text-red-600 text-sm mt-2 font-medium">
              You've reached your {feature.toLowerCase()} limit
            </p>
          )}
        </div>

        {/* Upgrade Options */}
        <div className="space-y-3 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium text-blue-900">Developer Plan</h4>
                <p className="text-blue-700 text-sm">10 {feature.toLowerCase()}, 10 GB storage</p>
              </div>
              <div className="text-blue-900 font-bold">$5/mo</div>
            </div>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium text-purple-900">Pro Plan</h4>
                <p className="text-purple-700 text-sm">25 {feature.toLowerCase()}, 50 GB storage</p>
              </div>
              <div className="text-purple-900 font-bold">$10/mo</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/hosting/upgrade')}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-colors flex items-center justify-center space-x-2"
          >
            <Crown className="h-4 w-4" />
            <span>Upgrade Now</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          
          <button
            onClick={onClose}
            className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  )
}
