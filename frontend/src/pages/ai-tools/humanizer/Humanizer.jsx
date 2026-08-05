"use client"

import { useState, useRef, useEffect } from "react"
import { Helmet } from "react-helmet"
import { useNavigate } from "react-router-dom"
import {
  PenTool,
  Copy,
  Download,
  RefreshCw,
  Settings,
  Wand2,
  FileText,
  CheckCircle,
  AlertCircle,
  Menu,
  ArrowLeft,
  Sparkles,
  Users,
  Clock,
  RotateCcw,
  Save,
  Share2,
  Volume2,
  Eye,
  Zap,
} from "lucide-react"
import aiToolsApi from "../../../lib/api/endpoints/aiTools"

export default function Humanizer() {
  const navigate = useNavigate()
  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [currentStyle, setCurrentStyle] = useState("natural")
  const [copiedOutput, setCopiedOutput] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [currentTaskId, setCurrentTaskId] = useState(null)
  const [apiError, setApiError] = useState(null)
  
  const textareaRef = useRef(null)
  const outputRef = useRef(null)

  const writingStyles = [
    { id: "natural", name: "Natural", description: "Conversational and human-like" },
    { id: "academic", name: "Academic", description: "Formal and scholarly tone" },
    { id: "casual", name: "Casual", description: "Relaxed and informal style" },
    { id: "professional", name: "Professional", description: "Business-appropriate tone" },
    { id: "creative", name: "Creative", description: "Engaging and imaginative" },
  ]

  useEffect(() => {
    const words = inputText.trim().split(/\\s+/).filter(word => word.length > 0).length
    setWordCount(inputText.trim() === "" ? 0 : words)
    setCharCount(inputText.length)
  }, [inputText])

  const simulateProcessing = async () => {
    if (!inputText.trim()) {
      setApiError("Please enter some text to humanize.");
      return;
    }

    setIsProcessing(true)
    setIsComplete(false)
    setProcessingProgress(0)
    setApiError(null)
    setOutputText("")
    
    try {
      
      // Prepare options
      const options = {
        writingStyle: currentStyle,
        preserveFormatting: true,
        targetTone: ""
      };

      // Use the API service to humanize text
      const result = await aiToolsApi.humanizeTextAndWait(
        inputText,
        options,
        (status) => {
          // Progress callback
          
          if (status.status === 'processing') {
            // Estimate progress based on time
            const elapsed = Date.now() - new Date(status.created_at).getTime();
            const estimatedProgress = Math.min(90, Math.floor((elapsed / 30000) * 90));
            setProcessingProgress(estimatedProgress);
          } else if (status.status === 'pending') {
            setProcessingProgress(10);
          }
        }
      );

      // Task completed successfully
      setOutputText(result.outputText);
      setProcessingProgress(100);
      setIsProcessing(false);
      setIsComplete(true);
      setCurrentTaskId(result.taskId);
      

    } catch (error) {
      console.error("Humanization failed:", error);
      setApiError(error.message || "Failed to humanize text. Please try again.");
      setIsProcessing(false);
      setIsComplete(false);
      setProcessingProgress(0);
    }
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedOutput(true)
      setTimeout(() => setCopiedOutput(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const downloadText = () => {
    const element = document.createElement("a")
    const file = new Blob([outputText], { type: "text/plain" })
    element.href = URL.createObjectURL(file)
    element.download = "humanized-text.txt"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const clearAll = () => {
    setInputText("")
    setOutputText("")
    setIsComplete(false)
    setProcessingProgress(0)
  }

  return (
    <>
      <Helmet>
        <title>Ufazien | Text Humanizer</title>
        <meta name="description" content="Transform AI-generated text into natural, human-like content with Ufazien's Text Humanizer." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-black bg-opacity-50 backdrop-blur-sm border-b border-gray-700 px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/ai-tools")}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to AI Tools</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg">
                <PenTool className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Text Humanizer</h1>
                <p className="text-sm text-gray-400">Transform AI text to natural language</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm border-b border-gray-700 p-4">
            <div className="max-w-7xl mx-auto">
              <h3 className="text-lg font-semibold text-white mb-4">Writing Style</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {writingStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setCurrentStyle(style.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      currentStyle === style.id
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    <div className="font-medium">{style.name}</div>
                    <div className="text-xs opacity-75">{style.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-7xl mx-auto">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{wordCount}</div>
                <div className="text-sm text-gray-400">Words</div>
              </div>
              <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-400">{charCount}</div>
                <div className="text-sm text-gray-400">Characters</div>
              </div>
              <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-400">{currentStyle}</div>
                <div className="text-sm text-gray-400">Style</div>
              </div>
              <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-yellow-400">
                  {isComplete ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                </div>
                <div className="text-sm text-gray-400">Status</div>
              </div>
            </div>

            {/* Error Display */}
            {apiError && (
              <div className="mb-6 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">Error</span>
                </div>
                <p className="text-sm text-red-300">
                  {apiError}
                </p>
                <button
                  onClick={() => setApiError(null)}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Main Editor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Input Text
                  </h3>
                  <button
                    onClick={clearAll}
                    className="text-sm text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Clear
                  </button>
                </div>
                
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your AI-generated text here to humanize it..."
                    className="w-full h-80 bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-4 text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  {inputText && (
                    <div className="absolute bottom-4 right-4 text-xs text-gray-400">
                      {wordCount} words • {charCount} characters
                    </div>
                  )}
                </div>

                <button
                  onClick={simulateProcessing}
                  disabled={!inputText.trim() || isProcessing}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:transform-none disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Humanizing... {processingProgress}%
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Humanize Text
                    </>
                  )}
                </button>
              </div>

              {/* Output Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Humanized Text
                  </h3>
                  {outputText && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(outputText)}
                        className="text-sm text-gray-400 hover:text-green-400 transition-colors flex items-center gap-1"
                      >
                        {copiedOutput ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedOutput ? "Copied!" : "Copy"}
                      </button>
                      <button
                        onClick={downloadText}
                        className="text-sm text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="relative">
                  <div
                    ref={outputRef}
                    className={`w-full h-80 bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-lg p-4 text-white overflow-y-auto transition-all ${
                      isComplete ? "border-green-500/50" : ""
                    }`}
                  >
                    {isProcessing ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-gray-400">Processing your text...</p>
                        <div className="w-full bg-gray-700 rounded-full h-2 mt-4">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${processingProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    ) : outputText ? (
                      <div className="space-y-2">
                        <div className="whitespace-pre-wrap">{outputText}</div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <div className="text-center">
                          <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Your humanized text will appear here</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {isComplete && (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">Humanization Complete!</span>
                    </div>
                    <p className="text-sm text-green-300">
                      Your text has been successfully transformed to sound more natural and human-like.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
