import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  PenTool,
  ChevronRight,
  Sparkles,
  Users,
  Clock,
  Star,
  ArrowRight,
} from "lucide-react"

import type React from "react"

interface HumanizerCardProps {
  tool: {
    id: string
    name: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    category: string
    stats?: string
    badge?: string
  }
}

export default function HumanizerCard({ tool }: HumanizerCardProps) {
  const navigate = useNavigate()
  const [isHovered, setIsHovered] = useState(false)

  const stats = {
    users: "2.5k+",
    rating: 4.8,
    avgTime: "30s",
  }

  const features = [
    "Natural language conversion",
    "Multiple writing styles",
    "Instant results",
    "Academic & casual modes",
  ]

  const handleUseClick = () => {
    navigate("/ai-tools/humanizer")
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main Card */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 hover:border-blue-500/50 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20 relative overflow-hidden">
        
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Featured Badge */}
        <div className="absolute top-3 right-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <Star className="w-3 h-3" />
          Featured
        </div>

        <div className="relative z-10">
          {/* Icon and Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <PenTool className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                  {tool.name}
                </h3>
                <p className="text-xs text-blue-400 font-medium">
                  {tool.category}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-300 text-sm mb-4 leading-relaxed">
            {tool.description}
          </p>

          {/* Features */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Key Features
            </h4>
            <div className="grid grid-cols-2 gap-1">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-1 text-xs text-gray-300">
                  <div className="w-1 h-1 bg-blue-400 rounded-full" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between mb-6 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
            <div className="text-center">
              <div className="text-sm font-bold text-white">{stats.users}</div>
              <div className="text-xs text-gray-400">Users</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                <span className="text-sm font-bold text-white">{stats.rating}</span>
              </div>
              <div className="text-xs text-gray-400">Rating</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-white">{stats.avgTime}</div>
              <div className="text-xs text-gray-400">Avg Time</div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleUseClick}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2 group/btn"
          >
            <span>Use Tool</span>
            <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${isHovered ? 'translate-x-1' : ''}`} />
          </button>

          {/* Quick Preview */}
          <div className="mt-3 text-center">
            <button className="text-xs text-gray-400 hover:text-blue-400 transition-colors">
              View examples →
            </button>
          </div>
        </div>

        {/* Hover Glow Effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>

      {/* Floating Particles Effect */}
      {isHovered && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-blue-400 rounded-full animate-ping"
              style={{
                left: `${20 + i * 30}%`,
                top: `${30 + i * 20}%`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: "2s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
