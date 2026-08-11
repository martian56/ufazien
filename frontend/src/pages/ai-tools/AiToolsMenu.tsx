"use client"

import { useState } from "react"
import type React from "react"
import { Helmet } from "react-helmet"
import { useNavigate } from "react-router-dom"
import {
  Brain,
  Sparkles,
  FileText,
  MessageSquare,
  ChevronRight,
  PenTool,
  ArrowLeft,
} from "lucide-react"
import HumanizerCard from "./humanizer/HumanizerCard"

export default function AiToolsMenu() {
  const navigate = useNavigate()

  const aiTools = [
    {
      id: "humanizer",
      name: "Text Humanizer",
      description: "Transform AI-generated text into natural, human-like content",
      icon: PenTool,
      category: "Writing",
      component: HumanizerCard,
    },
    {
      id: "paraphraser",
      name: "AI Paraphraser",
      description: "Rephrase and rewrite text while maintaining meaning",
      icon: MessageSquare,
      category: "Writing",
    },
    {
      id: "summarizer",
      name: "Text Summarizer",
      description: "Create concise summaries from long documents",
      icon: FileText,
      category: "Productivity",
    },
    {
      id: "grammar-checker",
      name: "Grammar Assistant",
      description: "Check and improve grammar, spelling, and style",
      icon: Sparkles,
      category: "Writing",
    },
  ]

  const categories = ["All", "Writing", "Productivity"]
  const [selectedCategory, setSelectedCategory] = useState("All")

  const filteredTools = aiTools.filter(
    (tool) => selectedCategory === "All" || tool.category === selectedCategory
  )

  return (
    <>
      <Helmet>
        <title>Ufazien | AI Tools</title>
        <meta name="description" content="Explore a variety of AI tools to enhance your productivity and creativity." />
      </Helmet>
      <div className="min-h-screen bg-white flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate("/dashboard")}
                className="p-2 -ml-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900 truncate">AI Tools</h1>
            </div>
            <p className="text-sm text-gray-500 hidden sm:block">Runs on Azure OpenAI</p>
          </div>
        </header>

        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-wrap gap-2 mb-8">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    selectedCategory === category
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
              {filteredTools.map((tool) => {
                if (tool.component) {
                  const ToolComponent = tool.component as React.ComponentType<{ tool: typeof tool }>
                  return <ToolComponent key={tool.id} tool={tool} />
                }

                const IconComponent = tool.icon
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => navigate(`/ai-tools/${tool.id}`)}
                    className="group flex flex-col text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors"
                  >
                    <div className="inline-flex p-2 rounded-md bg-gray-100 mb-4">
                      <IconComponent className="w-5 h-5 text-gray-700" />
                    </div>

                    <h2 className="font-semibold text-gray-900 mb-1">{tool.name}</h2>
                    <p className="text-sm text-gray-500 mb-4">{tool.description}</p>

                    <div className="flex items-center justify-between mt-auto pt-2">
                      <span className="text-xs font-medium text-gray-500">{tool.category}</span>
                      <span className="flex items-center gap-1 text-sm font-medium text-blue-600">
                        Open
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {filteredTools.length === 0 && (
              <div className="text-center py-16">
                <Brain className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <h2 className="font-medium text-gray-900 mb-1">No tools found</h2>
                <p className="text-sm text-gray-500">Try selecting a different category</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
