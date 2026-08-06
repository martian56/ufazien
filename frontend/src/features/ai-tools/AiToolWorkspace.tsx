"use client"

import { useEffect, useRef, useState } from "react"
import { Helmet } from "react-helmet"
import { useNavigate } from "react-router-dom"
import { AlertCircle, ArrowLeft, CheckCircle, Copy, Download, RefreshCw, RotateCcw } from "lucide-react"
import aiToolsApi from "../../lib/api/endpoints/aiTools"
import { copyText } from "../../lib/clipboard"
import { errorMessage } from "../../lib/api/errors"

import type React from "react"

interface ToolOption {
  id: string
  name: string
  description?: string
}

interface AiToolWorkspaceProps {
  toolType: string
  title: string
  tagline: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  inputLabel: string
  outputLabel: string
  placeholder: string
  actionLabel: string
  options?: ToolOption[]
  optionKey?: string
  optionLabel?: string
}


/**
 * The shared workspace behind the paraphraser, summarizer and grammar
 * assistant.
 *
 * All three were advertised on the AI Tools menu with a "Coming Soon" badge,
 * while services.py had implemented every one of them and /ai-tools/process/
 * accepted their tool types. The work was done; there was no page to reach it
 * from. One component covers the three because they differ only in the tool
 * type they send and the words around the boxes.
 */
export default function AiToolWorkspace({
  toolType,
  title,
  tagline,
  icon: Icon,
  accent,
  inputLabel,
  outputLabel,
  placeholder,
  actionLabel,
  options,
  optionKey,
  optionLabel,
}: AiToolWorkspaceProps) {
  const navigate = useNavigate()
  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [selectedOption, setSelectedOption] = useState<string | null>(options?.[0]?.id ?? null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0
  const MAX_CHARS = 10000

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const run = async () => {
    if (!inputText.trim() || isProcessing) return
    setIsProcessing(true)
    setError(null)
    setOutputText("")
    try {
      const payload = optionKey && selectedOption ? { [optionKey]: selectedOption } : {}
      const result = await aiToolsApi.processTextAndWait(toolType, inputText, payload)
      setOutputText(result.outputText || "")
      setElapsed(result.processingTime ?? null)
    } catch (err) {
      setError(errorMessage(err, "That did not go through. Try again in a moment."))
    } finally {
      setIsProcessing(false)
    }
  }

  const copyOutput = async () => {
    const ok = await copyText(outputText)
    setCopied(ok)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    const blob = new Blob([outputText], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${toolType}-${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    setInputText("")
    setOutputText("")
    setError(null)
    setElapsed(null)
    inputRef.current?.focus()
  }

  const boxClass =
    "w-full h-80 p-4 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

  return (
    <>
      <Helmet>
        <title>{title} | Ufazien AI Tools</title>
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
            <button
              onClick={() => navigate("/ai-tools")}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to AI Tools"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${accent} flex items-center justify-center`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-600">{tagline}</p>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {(options?.length ?? 0) > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">{optionLabel}</label>
              <div className="flex flex-wrap gap-2">
                {(options ?? []).map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedOption(option.id)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                      selectedOption === option.id
                        ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                    title={option.description}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">{inputLabel}</h2>
                <span className={`text-sm ${inputText.length > MAX_CHARS ? "text-red-600" : "text-gray-500"}`}>
                  {wordCount} words · {inputText.length}/{MAX_CHARS}
                </span>
              </div>
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={placeholder}
                className={boxClass}
              />
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={run}
                  disabled={!inputText.trim() || isProcessing || inputText.length > MAX_CHARS}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                  {isProcessing ? "Working..." : actionLabel}
                </button>
                <button
                  onClick={reset}
                  disabled={isProcessing}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Clear
                </button>
              </div>
              {inputText.length > MAX_CHARS && (
                <p className="mt-3 text-sm text-red-600">
                  That is longer than the {MAX_CHARS.toLocaleString()} characters this accepts. Trim it and try again.
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">{outputLabel}</h2>
                {elapsed !== null && (
                  <span className="text-sm text-gray-500">{Number(elapsed).toFixed(1)}s</span>
                )}
              </div>

              {error ? (
                <div className="h-80 flex flex-col items-center justify-center text-center px-6">
                  <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                  <p className="text-red-700 font-medium">Could not finish that</p>
                  <p className="text-sm text-gray-600 mt-1">{error}</p>
                </div>
              ) : (
                <textarea
                  value={outputText}
                  readOnly
                  placeholder={isProcessing ? "Working on it..." : "Your result will appear here."}
                  className={`${boxClass} bg-gray-50`}
                />
              )}

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={copyOutput}
                  disabled={!outputText}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={download}
                  disabled={!outputText}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
