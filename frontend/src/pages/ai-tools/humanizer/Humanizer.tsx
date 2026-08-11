"use client"

import { useState, useRef, useEffect } from "react"
import { Helmet } from "react-helmet"
import { useNavigate } from "react-router-dom"
import {
  Copy,
  Download,
  RefreshCw,
  Settings,
  Wand2,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  RotateCcw,
} from "lucide-react"
import aiToolsApi from "../../../lib/api/endpoints/aiTools"
import { errorMessage } from "../../../lib/api/errors"
import { copyText } from "../../../lib/clipboard"

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
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  
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
    const words = inputText.trim().split(/\s+/).filter(word => word.length > 0).length
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
            const elapsed = Date.now() - new Date((status as { created_at?: string }).created_at ?? Date.now()).getTime();
            const estimatedProgress = Math.min(90, Math.floor((elapsed / 30000) * 90));
            setProcessingProgress(estimatedProgress);
          } else if (status.status === 'pending') {
            setProcessingProgress(10);
          }
        }
      );

      // Task completed successfully
      setOutputText(result.outputText ?? "");
      setProcessingProgress(100);
      setIsProcessing(false);
      setIsComplete(true);
      setCurrentTaskId(result.taskId);
      

    } catch (error) {
      // errorMessage understands the DRF error shapes, so a provider outage
      // now reads as what the server actually said rather than "Task failed".
      setApiError(errorMessage(error, "Could not humanize that text. Try again in a moment."));
      setIsProcessing(false);
      setIsComplete(false);
      setProcessingProgress(0);
    }
  }

  const copyToClipboard = async (text: string) => {
    // The clipboard rejects whenever the document is not focused, and the
    // previous version treated that as nothing having happened.
    const copied = await copyText(text)
    setCopiedOutput(copied)
    setTimeout(() => setCopiedOutput(false), 2000)
    if (!copied) setApiError("Could not copy to the clipboard.")
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
      <div className="min-h-screen bg-white flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate("/ai-tools")}
                className="p-2 -ml-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Back to AI Tools"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 truncate">Text Humanizer</h1>
                <p className="hidden sm:block text-sm text-gray-500">Rewrite AI text so it reads naturally</p>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              aria-expanded={showSettings}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:border-gray-300 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Style</span>
            </button>
          </div>
        </header>

        {showSettings && (
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Writing style</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {writingStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setCurrentStyle(style.id)}
                    aria-pressed={currentStyle === style.id}
                    className={`p-3 rounded-md border text-left transition-colors ${
                      currentStyle === style.id
                        ? "bg-white border-blue-500 text-gray-900"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-sm font-medium">{style.name}</div>
                    <div className="text-xs text-gray-500">{style.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {apiError && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-700 mb-1">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Something went wrong</span>
                </div>
                <p className="text-sm text-red-700">{apiError}</p>
                <button
                  onClick={() => setApiError(null)}
                  className="mt-2 text-xs text-red-700 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    Your text
                  </h2>
                  <button
                    onClick={clearAll}
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Clear
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste the text you want to rewrite."
                  className="w-full h-80 bg-white border border-gray-300 rounded-lg p-4 text-gray-900 placeholder-gray-400 resize-none"
                />

                <p className="text-xs text-gray-500">
                  {wordCount} words, {charCount} characters, {currentStyle} style
                </p>

                <button
                  onClick={simulateProcessing}
                  disabled={!inputText.trim() || isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Rewriting, {processingProgress}%
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Humanize text
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-gray-400" />
                    Result
                  </h2>
                  {outputText && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => copyToClipboard(outputText)}
                        className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
                      >
                        {copiedOutput ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedOutput ? "Copied" : "Copy"}
                      </button>
                      <button
                        onClick={downloadText}
                        className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  )}
                </div>

                <div
                  ref={outputRef}
                  className="w-full h-80 bg-white border border-gray-200 rounded-lg p-4 text-gray-900 overflow-y-auto"
                >
                  {isProcessing ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <p className="text-sm text-gray-500 mb-3">Working on it</p>
                      <div className="w-full max-w-xs bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${processingProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : outputText ? (
                    <div className="whitespace-pre-wrap">{outputText}</div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-gray-500">The rewritten text will appear here.</p>
                    </div>
                  )}
                </div>

                {isComplete && (
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Done. Read it through before you use it.
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
