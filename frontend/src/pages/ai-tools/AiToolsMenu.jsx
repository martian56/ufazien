"use client"

import { useState } from "react"
import { Helmet } from "react-helmet"
import { useNavigate } from "react-router-dom"
import {
  Brain,
  Sparkles,
  FileText,
  MessageSquare,
  Settings,
  Menu,
  X,
  ChevronRight,
  Zap,
  Wand2,
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
      color: "from-blue-500 to-cyan-500",
      category: "Writing",
      featured: true,
      component: HumanizerCard,
    },
    {
      id: "paraphraser",
      name: "AI Paraphraser",
      description: "Rephrase and rewrite text while maintaining meaning",
      icon: MessageSquare,
      color: "from-purple-500 to-pink-500",
      category: "Writing",
      featured: false,
    },
    {
      id: "summarizer",
      name: "Text Summarizer",
      description: "Create concise summaries from long documents",
      icon: FileText,
      color: "from-green-500 to-emerald-500",
      category: "Productivity",
      featured: false,
    },
    {
      id: "grammar-checker",
      name: "Grammar Assistant",
      description: "Check and improve grammar, spelling, and style",
      icon: Sparkles,
      color: "from-orange-500 to-red-500",
      category: "Writing",
      featured: false,
    },
  ]

  const categories = ["All", "Writing", "Productivity", "Research"]
  const [selectedCategory, setSelectedCategory] = useState("All")

  const filteredTools = aiTools.filter(tool => 
    selectedCategory === "All" || tool.category === selectedCategory
  )

  return (
    <>
      <Helmet>
        <title>Ufazien | AI Tools</title>
        <meta name="description" content="Explore a variety of AI tools to enhance your productivity and creativity." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900">
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-black bg-opacity-50 backdrop-blur-sm border-b border-gray-700 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">AI Tools</h1>
                <p className="text-sm text-gray-400">Enhance your productivity with AI</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-gray-400">Powered by</p>
              <p className="text-sm font-semibold text-blue-400">OpenAI</p>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-3">
                Supercharge Your Studies with AI
              </h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Access powerful AI tools designed specifically for students. 
                Write better, learn faster, and achieve more.
              </p>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    selectedCategory === category
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-7xl mx-auto">
            {/* Featured Tools */}
            {filteredTools.some(tool => tool.featured) && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-xl font-bold text-white">Featured Tools</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTools
                    .filter(tool => tool.featured)
                    .map((tool) => {
                      const ToolComponent = tool.component
                      return <ToolComponent key={tool.id} tool={tool} />
                    })
                  }
                </div>
              </div>
            )}

            {/* All Tools */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-blue-400" />
                <h3 className="text-xl font-bold text-white">All Tools</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredTools.map((tool) => {
                  if (tool.component) {
                    const ToolComponent = tool.component
                    return <ToolComponent key={tool.id} tool={tool} />
                  }
                  
                  // Default card for tools without custom components
                  const IconComponent = tool.icon
                  return (
                    <div
                      key={tool.id}
                      onClick={() => navigate(`/ai-tools/${tool.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") navigate(`/ai-tools/${tool.id}`)
                      }}
                      className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:bg-opacity-70 transition-all duration-300 group relative overflow-hidden cursor-pointer"
                    >
                      {/* Coming Soon Badge */}
                      {tool.coming_soon && (
                        <div className="absolute top-3 right-3 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                          Coming Soon
                        </div>
                      )}

                      {/* Gradient Background */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
                      
                      <div className="relative">
                        <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${tool.color} mb-4`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        
                        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                          {tool.name}
                        </h3>
                        
                        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                          {tool.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">
                            {tool.category}
                          </span>
                          
                          <button
                            disabled={tool.coming_soon}
                            className={`flex items-center gap-1 text-sm font-medium transition-all ${
                              tool.coming_soon
                                ? "text-gray-500 cursor-not-allowed"
                                : "text-white hover:text-blue-400 group-hover:translate-x-1"
                            }`}
                          >
                            {tool.coming_soon ? "Soon" : "Use Tool"}
                            {!tool.coming_soon && <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* No tools message */}
            {filteredTools.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex p-4 bg-gray-800 rounded-full mb-4">
                  <Brain className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No tools found</h3>
                <p className="text-gray-400">Try selecting a different category</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
