import { useNavigate } from "react-router-dom"
import { PenTool, ChevronRight } from "lucide-react"

import type React from "react"

interface HumanizerCardProps {
  tool: {
    id: string
    name: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    category: string
  }
}

const FEATURES = [
  "Natural language conversion",
  "Multiple writing styles",
  "Academic and casual modes",
]

export default function HumanizerCard({ tool }: HumanizerCardProps) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate("/ai-tools/humanizer")}
      className="group flex flex-col text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors"
    >
      <div className="inline-flex p-2 rounded-md bg-blue-50 mb-4">
        <PenTool className="w-5 h-5 text-blue-600" />
      </div>

      <h2 className="font-semibold text-gray-900 mb-1">{tool.name}</h2>
      <p className="text-sm text-gray-500 mb-4">{tool.description}</p>

      <ul className="space-y-1 mb-4">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between mt-auto pt-2">
        <span className="text-xs font-medium text-gray-500">{tool.category}</span>
        <span className="flex items-center gap-1 text-sm font-medium text-blue-600">
          Open
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  )
}
